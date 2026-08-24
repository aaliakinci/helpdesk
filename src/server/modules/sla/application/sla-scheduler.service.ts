import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from "@nestjs/common";

import {
  PlatformConfigService,
  PrismaService,
  writeStructuredLog,
} from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import { SupportEventWriter } from "../../support/application/support-event-writer.service.js";
import type { SlaMilestone, SlaWarningStage } from "../domain/sla-policy.js";

interface DueStateRow {
  readonly databaseNow: Date;
  readonly tenantId: string;
  readonly ticketId: string;
}

type LockedState = NonNullable<Awaited<ReturnType<SlaSchedulerService["readState"]>>>;

@Injectable()
export class SlaSchedulerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private activeRun: Promise<number> | undefined;
  private interval: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlatformConfigService,
    private readonly events: SupportEventWriter,
  ) {}

  public onApplicationBootstrap(): void {
    void this.runOnce().catch(() => undefined);
    this.interval = setInterval(
      () => void this.runOnce().catch(() => undefined),
      this.config.values.slaSchedulerIntervalMs,
    );
    this.interval.unref();
  }

  public async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.interval) clearInterval(this.interval);
    await this.activeRun?.catch(() => undefined);
  }

  public runOnce(): Promise<number> {
    if (this.activeRun || this.stopping) return Promise.resolve(0);
    const run = this.executeBatch();
    this.activeRun = run;
    return run.finally(() => {
      if (this.activeRun === run) this.activeRun = undefined;
    });
  }

  private async executeBatch(): Promise<number> {
    try {
      const processed = await this.prisma.$transaction(
        async (transaction) => {
          const rows = await transaction.$queryRaw<readonly DueStateRow[]>`
            SELECT
              state."tenant_id" AS "tenantId",
              state."ticket_id" AS "ticketId",
              CURRENT_TIMESTAMP AS "databaseNow"
            FROM "ticket_sla_states" state
            INNER JOIN "tickets" ticket
              ON ticket."tenant_id" = state."tenant_id"
             AND ticket."id" = state."ticket_id"
            WHERE (
                ticket."status" = 'RESOLVED'
                AND state."auto_close_at" IS NOT NULL
                AND state."auto_close_at" <= CURRENT_TIMESTAMP
              ) OR (
                ticket."status" <> 'CLOSED'
                AND (
                  (state."first_response_status" = 'ACTIVE'
                    AND state."first_response_approaching_at" <= CURRENT_TIMESTAMP)
                  OR (state."first_response_status" = 'APPROACHING'
                    AND state."first_response_due_at" <= CURRENT_TIMESTAMP)
                  OR (state."resolution_status" = 'ACTIVE'
                    AND state."resolution_approaching_at" <= CURRENT_TIMESTAMP)
                  OR (state."resolution_status" = 'APPROACHING'
                    AND state."resolution_due_at" <= CURRENT_TIMESTAMP)
                )
              )
            ORDER BY LEAST(
              COALESCE(state."auto_close_at", 'infinity'::timestamptz),
              CASE WHEN state."first_response_status" = 'COMPLETED'
                THEN 'infinity'::timestamptz ELSE state."first_response_approaching_at" END,
              CASE WHEN state."resolution_status" = 'COMPLETED'
                THEN 'infinity'::timestamptz ELSE state."resolution_approaching_at" END
            ), state."ticket_id"
            FOR UPDATE OF state, ticket SKIP LOCKED
            LIMIT ${this.config.values.slaSchedulerBatchSize}
          `;
          for (const row of rows) await this.processLockedState(transaction, row);
          return rows.length;
        },
        { timeout: 30_000 },
      );
      if (processed > 0) {
        writeStructuredLog("support-worker", "info", "sla.scheduler.batch_completed", {
          processed,
        });
      }
      return processed;
    } catch (error: unknown) {
      writeStructuredLog("support-worker", "error", "sla.scheduler.failed", {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
      throw error;
    }
  }

  private async processLockedState(
    transaction: Prisma.TransactionClient,
    row: DueStateRow,
  ): Promise<void> {
    const state = await this.readState(transaction, row.tenantId, row.ticketId);
    if (!state) return;
    if (
      state.ticket.status === "RESOLVED" &&
      state.autoCloseAt !== null &&
      state.autoCloseAt <= row.databaseNow
    ) {
      await this.autoClose(transaction, state, row.databaseNow);
      return;
    }
    if (state.ticket.status === "CLOSED") return;
    await this.processMilestone(transaction, state, "FIRST_RESPONSE", row.databaseNow);
    await this.processMilestone(transaction, state, "RESOLUTION", row.databaseNow);
  }

  private readState(transaction: Prisma.TransactionClient, tenantId: string, ticketId: string) {
    return transaction.ticketSlaState.findUnique({
      include: {
        ticket: {
          select: {
            currentAssigneeMembershipId: true,
            id: true,
            number: true,
            status: true,
            subject: true,
            version: true,
          },
        },
      },
      where: { tenantId_ticketId: { tenantId, ticketId } },
    });
  }

  private async processMilestone(
    transaction: Prisma.TransactionClient,
    state: LockedState,
    milestone: SlaMilestone,
    now: Date,
  ): Promise<void> {
    const firstResponse = milestone === "FIRST_RESPONSE";
    const status = firstResponse ? state.firstResponseStatus : state.resolutionStatus;
    const dueAt = firstResponse ? state.firstResponseDueAt : state.resolutionDueAt;
    const approachingAt = firstResponse
      ? state.firstResponseApproachingAt
      : state.resolutionApproachingAt;
    if (status === "COMPLETED") return;
    if (dueAt <= now && status !== "BREACHED") {
      await this.issueWarning(transaction, state, milestone, "BREACHED", dueAt, now);
    } else if (approachingAt <= now && status === "ACTIVE") {
      await this.issueWarning(transaction, state, milestone, "APPROACHING", dueAt, now);
    }
  }

  private async issueWarning(
    transaction: Prisma.TransactionClient,
    state: LockedState,
    milestone: SlaMilestone,
    stage: SlaWarningStage,
    dueAt: Date,
    now: Date,
  ): Promise<void> {
    const firstResponse = milestone === "FIRST_RESPONSE";
    await transaction.ticketSlaState.update({
      data: {
        ...(firstResponse
          ? stage === "APPROACHING"
            ? { firstResponseApproachingSentAt: now, firstResponseStatus: "APPROACHING" as const }
            : { firstResponseBreachedAt: now, firstResponseStatus: "BREACHED" as const }
          : stage === "APPROACHING"
            ? { resolutionApproachingSentAt: now, resolutionStatus: "APPROACHING" as const }
            : { resolutionBreachedAt: now, resolutionStatus: "BREACHED" as const }),
        version: { increment: 1 },
      },
      where: { tenantId_ticketId: { tenantId: state.tenantId, ticketId: state.ticketId } },
    });
    const messageId = await this.events.writeSystem(transaction, state.tenantId, {
      action: `ticket.sla.${stage.toLowerCase()}`,
      aggregateId: state.ticket.id,
      aggregateType: "ticket",
      eventType: "ticket.sla-warning.v1",
      metadata: { milestone, stage },
      payload: {
        dueAtUtc: dueAt.toISOString(),
        milestone,
        stage,
        ticketId: state.ticket.id,
        ticketNumber: state.ticket.number,
        version: state.ticket.version,
      },
    });
    const recipients = await transaction.tenantMembership.findMany({
      select: { id: true },
      where: {
        OR: [
          { role: { in: ["OWNER", "MANAGER"] } },
          ...(state.ticket.currentAssigneeMembershipId
            ? [{ id: state.ticket.currentAssigneeMembershipId }]
            : []),
        ],
        status: "ACTIVE",
        tenantId: state.tenantId,
      },
    });
    const kind = stage === "APPROACHING" ? "TICKET_SLA_APPROACHING" : "TICKET_SLA_BREACHED";
    for (const recipient of recipients) {
      await transaction.notification.create({
        data: {
          deliveries: {
            create: {
              channel: "IN_APP",
              deduplicationKey: `sla:${state.ticket.id}:${milestone}:${stage}:${recipient.id}:in-app`,
              deliveredAt: now,
              status: "DELIVERED",
            },
          },
          kind,
          payload: {
            dueAtUtc: dueAt.toISOString(),
            milestone,
            stage,
            subject: state.ticket.subject,
            ticketId: state.ticket.id,
            ticketNumber: state.ticket.number,
          },
          recipientMembershipId: recipient.id,
          sourceMessageId: messageId,
          tenantId: state.tenantId,
          ticketId: state.ticket.id,
        },
      });
    }
  }

  private async autoClose(
    transaction: Prisma.TransactionClient,
    state: LockedState,
    now: Date,
  ): Promise<void> {
    const nextVersion = state.ticket.version + 1;
    const advanced = await transaction.ticket.updateMany({
      data: { closedAt: now, status: "CLOSED", version: { increment: 1 } },
      where: {
        id: state.ticket.id,
        status: "RESOLVED",
        tenantId: state.tenantId,
        version: state.ticket.version,
      },
    });
    if (advanced.count !== 1) return;
    await transaction.ticketSlaState.update({
      data: { autoCloseAt: null, version: { increment: 1 } },
      where: { tenantId_ticketId: { tenantId: state.tenantId, ticketId: state.ticketId } },
    });
    await transaction.ticketStatusHistory.create({
      data: {
        actorType: "SYSTEM",
        fromStatus: "RESOLVED",
        tenantId: state.tenantId,
        ticketId: state.ticket.id,
        toStatus: "CLOSED",
        version: nextVersion,
      },
    });
    await this.events.writeSystem(transaction, state.tenantId, {
      action: "ticket.auto-closed",
      aggregateId: state.ticket.id,
      aggregateType: "ticket",
      eventType: "ticket.status-changed.v1",
      metadata: { automated: true, from: "RESOLVED", to: "CLOSED" },
      payload: {
        automated: true,
        fromStatus: "RESOLVED",
        ticketId: state.ticket.id,
        ticketNumber: state.ticket.number,
        toStatus: "CLOSED",
        version: nextVersion,
      },
    });
  }
}
