import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { PrismaService, SessionInvalidationService } from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import type { QueueView } from "./support.types.js";
import { QueueQueryService } from "./queue-query.service.js";
import { SupportEventWriter } from "./support-event-writer.service.js";

@Injectable()
export class QueueCommandService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: SupportEventWriter,
    private readonly queries: QueueQueryService,
    @Optional() private readonly sessionInvalidations?: SessionInvalidationService,
  ) {}

  public async createQueue(
    identity: AuthenticatedIdentity,
    input: { readonly description: string | null; readonly name: string },
  ): Promise<QueueView> {
    this.assertManage(identity);
    try {
      const queueId = await this.prisma.$transaction(async (transaction) => {
        const queue = await transaction.queue.create({
          data: { description: input.description, name: input.name, tenantId: identity.tenantId },
        });
        await transaction.queueAssignmentState.create({
          data: { queueId: queue.id, tenantId: identity.tenantId },
        });
        await this.events.write(transaction, identity, {
          action: "queue.created",
          aggregateId: queue.id,
          aggregateType: "queue",
          eventType: "queue.created.v1",
          metadata: null,
          payload: { name: queue.name, queueId: queue.id, version: queue.version },
        });
        return queue.id;
      });
      return this.queries.getQueue(identity, queueId);
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("Queue name already exists in this tenant.");
      }
      throw error;
    }
  }

  public async updateQueue(
    identity: AuthenticatedIdentity,
    queueId: string,
    input: {
      readonly description: string | null;
      readonly expectedVersion: number;
      readonly name: string;
      readonly status: "ACTIVE" | "DISABLED";
    },
  ): Promise<QueueView> {
    this.assertManage(identity);
    try {
      const invalidatedMembershipIds = await this.prisma.$transaction(async (transaction) => {
        const queue = await transaction.queue.findUnique({
          where: { tenantId_id: { id: queueId, tenantId: identity.tenantId } },
        });
        if (!queue) throw new NotFoundException("Queue was not found.");
        const updated = await transaction.queue.updateMany({
          where: { id: queue.id, tenantId: identity.tenantId, version: input.expectedVersion },
          data: {
            description: input.description,
            name: input.name,
            status: input.status,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new ConflictException("Queue revision is stale.");
        await this.events.write(transaction, identity, {
          action: "queue.updated",
          aggregateId: queue.id,
          aggregateType: "queue",
          eventType: "queue.updated.v1",
          metadata: { fromStatus: queue.status, toStatus: input.status },
          payload: {
            name: input.name,
            queueId: queue.id,
            status: input.status,
            version: input.expectedVersion + 1,
          },
        });
        if (queue.status === input.status) return [];
        const members = await transaction.queueMember.findMany({
          select: { membershipId: true },
          where: { queueId: queue.id, status: "ACTIVE", tenantId: identity.tenantId },
        });
        return members.map((member) => member.membershipId);
      });
      const invalidations = this.sessionInvalidations;
      if (invalidations) {
        await Promise.all(
          invalidatedMembershipIds.map((membershipId) =>
            invalidations.publish({ id: membershipId, scope: "MEMBERSHIP" }),
          ),
        );
      }
      return this.queries.getQueue(identity, queueId);
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("Queue name already exists in this tenant.");
      }
      throw error;
    }
  }

  public async setMember(
    identity: AuthenticatedIdentity,
    queueId: string,
    input: {
      readonly expectedVersion: number;
      readonly membershipId: string;
      readonly status: "ACTIVE" | "DISABLED";
    },
  ): Promise<QueueView> {
    this.assertManage(identity);
    await this.prisma.$transaction(async (transaction) => {
      const [queue, membership] = await Promise.all([
        transaction.queue.findUnique({
          where: { tenantId_id: { id: queueId, tenantId: identity.tenantId } },
        }),
        transaction.tenantMembership.findUnique({
          where: {
            tenantId_id: { id: input.membershipId, tenantId: identity.tenantId },
          },
        }),
      ]);
      if (!queue) throw new NotFoundException("Queue was not found.");
      if (!membership || membership.role !== "AGENT" || membership.status !== "ACTIVE") {
        throw new NotFoundException("Eligible agent membership was not found.");
      }
      if (input.status === "DISABLED") {
        const assignedOpenTickets = await transaction.ticket.count({
          where: {
            currentAssigneeMembershipId: membership.id,
            currentQueueId: queue.id,
            status: { in: ["NEW", "OPEN", "PENDING"] },
            tenantId: identity.tenantId,
          },
        });
        if (assignedOpenTickets > 0) {
          throw new ConflictException("Reassign open tickets before disabling this queue member.");
        }
      }
      const updated = await transaction.queue.updateMany({
        where: { id: queue.id, tenantId: identity.tenantId, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("Queue revision is stale.");
      await transaction.queueMember.upsert({
        create: {
          membershipId: membership.id,
          queueId: queue.id,
          status: input.status,
          tenantId: identity.tenantId,
        },
        update: { status: input.status },
        where: {
          tenantId_queueId_membershipId: {
            membershipId: membership.id,
            queueId: queue.id,
            tenantId: identity.tenantId,
          },
        },
      });
      await this.events.write(transaction, identity, {
        action: "queue.member.changed",
        aggregateId: queue.id,
        aggregateType: "queue",
        eventType: "queue.member-changed.v1",
        metadata: { membershipId: membership.id, status: input.status },
        payload: {
          membershipId: membership.id,
          queueId: queue.id,
          status: input.status,
          version: input.expectedVersion + 1,
        },
      });
    });
    await this.sessionInvalidations?.publish({ id: input.membershipId, scope: "MEMBERSHIP" });
    return this.queries.getQueue(identity, queueId);
  }

  private assertManage(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "queues.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
