import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import type { EligibleQueueMember, QueueView } from "./support.types.js";

const queueInclude = {
  members: {
    orderBy: [
      { membership: { user: { displayName: "asc" as const } } },
      { membershipId: "asc" as const },
    ],
    include: { membership: { include: { user: true } } },
  },
} satisfies Prisma.QueueInclude;

type QueueRecord = Prisma.QueueGetPayload<{ include: typeof queueInclude }>;

@Injectable()
export class QueueQueryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listQueues(identity: AuthenticatedIdentity): Promise<readonly QueueView[]> {
    const queues = await this.prisma.queue.findMany({
      where: this.accessWhere(identity),
      include: queueInclude,
      orderBy: [{ status: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    return this.enrich(queues, identity.tenantId);
  }

  public async getQueue(identity: AuthenticatedIdentity, queueId: string): Promise<QueueView> {
    const queue = await this.prisma.queue.findFirst({
      where: { ...this.accessWhere(identity), id: queueId },
      include: queueInclude,
    });
    if (!queue) throw new NotFoundException("Queue was not found.");
    return (await this.enrich([queue], identity.tenantId))[0] as QueueView;
  }

  public async listEligibleMembers(
    identity: AuthenticatedIdentity,
  ): Promise<readonly EligibleQueueMember[]> {
    if (!hasPermission(identity.role, "queues.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { role: "AGENT", status: "ACTIVE", tenantId: identity.tenantId },
      include: { user: true },
      orderBy: [{ user: { displayName: "asc" } }, { id: "asc" }],
    });
    return memberships.map((membership) => ({
      displayName: membership.user.displayName,
      email: membership.user.email,
      membershipId: membership.id,
    }));
  }

  public accessWhere(identity: AuthenticatedIdentity): Prisma.QueueWhereInput {
    if (!hasPermission(identity.role, "queues.read")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    return {
      tenantId: identity.tenantId,
      ...(identity.role === "AGENT"
        ? {
            members: {
              some: { membershipId: identity.membershipId, status: "ACTIVE" as const },
            },
          }
        : {}),
    };
  }

  private async enrich(
    queues: readonly QueueRecord[],
    tenantId: string,
  ): Promise<readonly QueueView[]> {
    const queueIds = queues.map((queue) => queue.id);
    if (queueIds.length === 0) return [];
    const [open, unassigned] = await this.prisma.$transaction([
      this.prisma.ticket.groupBy({
        by: ["currentQueueId"],
        orderBy: { currentQueueId: "asc" },
        where: {
          currentQueueId: { in: queueIds },
          status: { in: ["NEW", "OPEN", "PENDING"] },
          tenantId,
        },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ["currentQueueId"],
        orderBy: { currentQueueId: "asc" },
        where: {
          currentAssigneeMembershipId: null,
          currentQueueId: { in: queueIds },
          status: { in: ["NEW", "OPEN", "PENDING"] },
          tenantId,
        },
        _count: true,
      }),
    ]);
    const openCounts = new Map(
      open.map((item) => [item.currentQueueId, readAggregateCount(item._count)]),
    );
    const unassignedCounts = new Map(
      unassigned.map((item) => [item.currentQueueId, readAggregateCount(item._count)]),
    );
    return queues.map((queue) => ({
      activeMemberCount: queue.members.filter((member) => member.status === "ACTIVE").length,
      createdAtUtc: queue.createdAt.toISOString(),
      description: queue.description,
      id: queue.id,
      members: queue.members.map((member) => ({
        displayName: member.membership.user.displayName,
        email: member.membership.user.email,
        membershipId: member.membershipId,
        role: member.membership.role,
        status: member.status,
      })),
      name: queue.name,
      openTicketCount: openCounts.get(queue.id) ?? 0,
      status: queue.status,
      unassignedTicketCount: unassignedCounts.get(queue.id) ?? 0,
      updatedAtUtc: queue.updatedAt.toISOString(),
      version: queue.version,
    }));
  }
}

function readAggregateCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "_all" in value) {
    const count = (value as { readonly _all?: unknown })._all;
    if (typeof count === "number") return count;
  }
  throw new TypeError("Ticket aggregate count is invalid.");
}
