import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import type { AgentWorkloadItem, OperationsDashboard } from "./support.types.js";
import { ticketReadScope } from "./ticket-access.js";

const OPEN_STATUSES = ["NEW", "OPEN", "PENDING"] as const;

@Injectable()
export class OperationsQueryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async dashboard(identity: AuthenticatedIdentity): Promise<OperationsDashboard> {
    if (!hasPermission(identity.role, "tickets.read") || identity.role === "REQUESTER") {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const scope = ticketReadScope(identity);
    const [openTickets, unassignedTickets, myOpenTickets, queues] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where: { AND: [scope, { status: { in: [...OPEN_STATUSES] } }] } }),
      this.prisma.ticket.count({
        where: {
          AND: [scope, { currentAssigneeMembershipId: null, status: { in: [...OPEN_STATUSES] } }],
        },
      }),
      this.prisma.ticket.count({
        where: {
          AND: [
            scope,
            {
              currentAssigneeMembershipId: identity.membershipId,
              status: { in: [...OPEN_STATUSES] },
            },
          ],
        },
      }),
      this.prisma.queue.findMany({
        where: {
          tenantId: identity.tenantId,
          ...(identity.role === "AGENT"
            ? {
                members: {
                  some: { membershipId: identity.membershipId, status: "ACTIVE" as const },
                },
              }
            : {}),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
    ]);
    const queueIds = queues.map((queue) => queue.id);
    const [openByQueue, unassignedByQueue] =
      queueIds.length === 0
        ? [[], []]
        : await this.prisma.$transaction([
            this.prisma.ticket.groupBy({
              by: ["currentQueueId"],
              orderBy: { currentQueueId: "asc" },
              where: {
                currentQueueId: { in: queueIds },
                status: { in: [...OPEN_STATUSES] },
                tenantId: identity.tenantId,
              },
              _count: true,
            }),
            this.prisma.ticket.groupBy({
              by: ["currentQueueId"],
              orderBy: { currentQueueId: "asc" },
              where: {
                currentAssigneeMembershipId: null,
                currentQueueId: { in: queueIds },
                status: { in: [...OPEN_STATUSES] },
                tenantId: identity.tenantId,
              },
              _count: true,
            }),
          ]);
    const openCounts = new Map(
      openByQueue.map((item) => [item.currentQueueId, readAggregateCount(item._count)]),
    );
    const unassignedCounts = new Map(
      unassignedByQueue.map((item) => [item.currentQueueId, readAggregateCount(item._count)]),
    );
    return {
      myOpenTickets,
      openTickets,
      queues: queues.map((queue) => ({
        id: queue.id,
        name: queue.name,
        openTickets: openCounts.get(queue.id) ?? 0,
        unassignedTickets: unassignedCounts.get(queue.id) ?? 0,
      })),
      sla: { breachedTickets: null, dueSoonTickets: null, status: "NOT_CONFIGURED" },
      unassignedTickets,
    };
  }

  public async agentWorkload(
    identity: AuthenticatedIdentity,
    queueId: string | null,
  ): Promise<readonly AgentWorkloadItem[]> {
    if (!hasPermission(identity.role, "queues.read") || identity.role === "REQUESTER") {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const queueScope: Prisma.QueueMemberWhereInput = {
      membership: { role: "AGENT", status: "ACTIVE" },
      status: "ACTIVE",
      tenantId: identity.tenantId,
      ...(queueId ? { queueId } : {}),
      ...(identity.role === "AGENT" ? { membershipId: identity.membershipId } : {}),
    };
    const members = await this.prisma.queueMember.findMany({
      where: queueScope,
      include: { membership: { include: { user: true } } },
      orderBy: [{ membership: { user: { displayName: "asc" } } }, { membershipId: "asc" }],
    });
    const grouped = new Map<
      string,
      { displayName: string; membershipId: string; queueIds: Set<string> }
    >();
    for (const member of members) {
      const existing = grouped.get(member.membershipId);
      if (existing) existing.queueIds.add(member.queueId);
      else {
        grouped.set(member.membershipId, {
          displayName: member.membership.user.displayName,
          membershipId: member.membershipId,
          queueIds: new Set([member.queueId]),
        });
      }
    }
    const membershipIds = [...grouped.keys()];
    const counts =
      membershipIds.length === 0
        ? []
        : await this.prisma.ticket.groupBy({
            by: ["currentAssigneeMembershipId"],
            where: {
              currentAssigneeMembershipId: { in: membershipIds },
              ...(queueId ? { currentQueueId: queueId } : {}),
              status: { in: [...OPEN_STATUSES] },
              tenantId: identity.tenantId,
            },
            _count: { _all: true },
          });
    const countByMembership = new Map(
      counts.map((item) => [item.currentAssigneeMembershipId, item._count._all]),
    );
    return [...grouped.values()].map((member) => ({
      assignedOpenTickets: countByMembership.get(member.membershipId) ?? 0,
      displayName: member.displayName,
      membershipId: member.membershipId,
      queueIds: [...member.queueIds].sort(),
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
