import { Injectable } from "@nestjs/common";

import { writeStructuredLog } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import { selectNextRoundRobinMember } from "../../support/domain/round-robin-policy.js";
import { SupportEventWriter } from "../../support/application/support-event-writer.service.js";
import type {
  IntegrationEventEnvelope,
  TicketCreatedPayload,
} from "../domain/integration-event-envelope.js";
import { IdempotentConsumerService } from "./idempotent-consumer.service.js";

const CONSUMER_NAME = "ticket-created.round-robin.v1";

@Injectable()
export class TicketCreatedAssignmentService {
  public constructor(
    private readonly idempotency: IdempotentConsumerService,
    private readonly events: SupportEventWriter,
  ) {}

  public async handle(
    envelope: IntegrationEventEnvelope,
    payload: TicketCreatedPayload,
  ): Promise<void> {
    const result = await this.idempotency.run(CONSUMER_NAME, envelope, async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { tenantId_id: { id: payload.ticketId, tenantId: envelope.tenantId } },
      });
      if (!ticket) throw new Error("TicketCreated event references a missing ticket.");
      if (ticket.currentQueueId || ticket.currentAssigneeMembershipId) return;

      const queue = await transaction.queue.findFirst({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true },
        where: {
          members: {
            some: {
              membership: { role: "AGENT", status: "ACTIVE" },
              status: "ACTIVE",
            },
          },
          status: "ACTIVE",
          tenantId: envelope.tenantId,
        },
      });
      if (!queue) throw new Error("Tenant has no active queue with an active agent member.");

      await transaction.queueAssignmentState.upsert({
        create: { queueId: queue.id, tenantId: envelope.tenantId },
        update: {},
        where: { tenantId_queueId: { queueId: queue.id, tenantId: envelope.tenantId } },
      });
      const cursor = await lockAssignmentCursor(transaction, envelope.tenantId, queue.id);
      const candidates = await transaction.queueMember.findMany({
        orderBy: { membershipId: "asc" },
        select: { membershipId: true },
        where: {
          membership: { role: "AGENT", status: "ACTIVE" },
          queueId: queue.id,
          status: "ACTIVE",
          tenantId: envelope.tenantId,
        },
      });
      const assigneeId = selectNextRoundRobinMember(
        candidates.map((candidate) => candidate.membershipId),
        cursor,
      );
      if (!assigneeId) throw new Error("Queue has no eligible round-robin member.");

      const nextVersion = ticket.version + 1;
      const updated = await transaction.ticket.updateMany({
        data: {
          assignedAt: new Date(),
          currentAssigneeMembershipId: assigneeId,
          currentQueueId: queue.id,
          version: { increment: 1 },
        },
        where: {
          currentAssigneeMembershipId: null,
          currentQueueId: null,
          id: ticket.id,
          tenantId: envelope.tenantId,
          version: ticket.version,
        },
      });
      if (updated.count !== 1) throw new Error("Ticket changed during automatic assignment.");

      await transaction.ticketAssignment.create({
        data: {
          action: "ROUND_ROBIN_ASSIGNED",
          actorUserId: ticket.createdByUserId,
          tenantId: envelope.tenantId,
          ticketId: ticket.id,
          toAssigneeMembershipId: assigneeId,
          toQueueId: queue.id,
          version: nextVersion,
        },
      });
      await transaction.queueAssignmentState.update({
        data: { lastAssignedMembershipId: assigneeId, version: { increment: 1 } },
        where: { tenantId_queueId: { queueId: queue.id, tenantId: envelope.tenantId } },
      });
      await this.events.write(
        transaction,
        { tenantId: envelope.tenantId, userId: ticket.createdByUserId },
        {
          action: "ticket.assignment.changed",
          aggregateId: ticket.id,
          aggregateType: "ticket",
          eventType: "ticket.assignment-changed.v1",
          metadata: {
            action: "ROUND_ROBIN_ASSIGNED",
            toAssigneeMembershipId: assigneeId,
            toQueueId: queue.id,
          },
          payload: {
            action: "ROUND_ROBIN_ASSIGNED",
            ticketId: ticket.id,
            ticketNumber: ticket.number,
            toAssigneeMembershipId: assigneeId,
            toQueueId: queue.id,
            version: nextVersion,
          },
        },
      );
    });
    writeStructuredLog("support-worker", "info", "ticket.assignment.consumed", {
      duplicate: result === "duplicate",
      messageId: envelope.messageId,
      traceparent: envelope.traceparent,
    });
  }
}

async function lockAssignmentCursor(
  transaction: Prisma.TransactionClient,
  tenantId: string,
  queueId: string,
): Promise<string | null> {
  const rows = await transaction.$queryRaw<
    readonly { last_assigned_membership_id: string | null }[]
  >`
    SELECT "last_assigned_membership_id"
    FROM "queue_assignment_states"
    WHERE "tenant_id" = CAST(${tenantId} AS UUID)
      AND "queue_id" = CAST(${queueId} AS UUID)
    FOR UPDATE
  `;
  return rows[0]?.last_assigned_membership_id ?? null;
}
