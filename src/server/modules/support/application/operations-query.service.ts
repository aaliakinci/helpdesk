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
    const clock = await this.prisma.$queryRaw<readonly { now: Date }[]>`
      SELECT CURRENT_TIMESTAMP AS "now"
    `;
    const now = clock[0]?.now;
    if (!now) throw new Error("Database clock could not be read.");
    const activeTicketScope: Prisma.TicketWhereInput = {
      AND: [scope, { status: { not: "CLOSED" } }],
    };
    const breachedConditions: readonly Prisma.TicketSlaStateWhereInput[] = [
      { firstResponseCompletedAt: null, firstResponseDueAt: { lte: now } },
      { resolutionCompletedAt: null, resolutionDueAt: { lte: now } },
    ];
    const approachingConditions: readonly Prisma.TicketSlaStateWhereInput[] = [
      {
        firstResponseApproachingAt: { lte: now },
        firstResponseCompletedAt: null,
        firstResponseDueAt: { gt: now },
      },
      {
        resolutionApproachingAt: { lte: now },
        resolutionCompletedAt: null,
        resolutionDueAt: { gt: now },
      },
    ];
    const [
      openTickets,
      unassignedTickets,
      myOpenTickets,
      queues,
      policy,
      breachedTickets,
      approachingTickets,
      warningStates,
    ] = await this.prisma.$transaction([
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
      this.prisma.slaPolicy.findUnique({
        select: { id: true },
        where: { tenantId: identity.tenantId },
      }),
      this.prisma.ticketSlaState.count({
        where: { OR: [...breachedConditions], ticket: { is: activeTicketScope } },
      }),
      this.prisma.ticketSlaState.count({
        where: {
          AND: [{ OR: [...approachingConditions] }, { NOT: { OR: [...breachedConditions] } }],
          ticket: { is: activeTicketScope },
        },
      }),
      this.prisma.ticketSlaState.findMany({
        include: {
          ticket: {
            select: {
              currentAssignee: {
                select: { id: true, user: { select: { displayName: true } } },
              },
              currentQueue: { select: { id: true, name: true } },
              id: true,
              number: true,
              priority: true,
              subject: true,
            },
          },
        },
        take: 100,
        where: {
          OR: [...breachedConditions, ...approachingConditions],
          ticket: { is: activeTicketScope },
        },
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
    const warnings = warningStates
      .map((state) => {
        const firstResponseStatus = milestoneStatus(
          now,
          state.firstResponseApproachingAt,
          state.firstResponseDueAt,
          state.firstResponseCompletedAt,
        );
        const resolutionStatus = milestoneStatus(
          now,
          state.resolutionApproachingAt,
          state.resolutionDueAt,
          state.resolutionCompletedAt,
        );
        return {
          assignee: state.ticket.currentAssignee
            ? {
                displayName: state.ticket.currentAssignee.user.displayName,
                membershipId: state.ticket.currentAssignee.id,
              }
            : null,
          firstResponseStatus,
          id: state.ticket.id,
          nextDueAtUtc: earliestOutstandingDue(state).toISOString(),
          number: state.ticket.number,
          priority: state.ticket.priority,
          queue: state.ticket.currentQueue,
          resolutionStatus,
          subject: state.ticket.subject,
        };
      })
      .filter(
        (warning) =>
          warning.firstResponseStatus === "APPROACHING" ||
          warning.firstResponseStatus === "BREACHED" ||
          warning.resolutionStatus === "APPROACHING" ||
          warning.resolutionStatus === "BREACHED",
      )
      .sort((left, right) => left.nextDueAtUtc.localeCompare(right.nextDueAtUtc))
      .slice(0, 20);
    return {
      myOpenTickets,
      openTickets,
      queues: queues.map((queue) => ({
        id: queue.id,
        name: queue.name,
        openTickets: openCounts.get(queue.id) ?? 0,
        unassignedTickets: unassignedCounts.get(queue.id) ?? 0,
      })),
      sla: policy
        ? { approachingTickets, breachedTickets, status: "ACTIVE", warnings }
        : {
            approachingTickets: null,
            breachedTickets: null,
            status: "NOT_CONFIGURED",
            warnings: [],
          },
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

function milestoneStatus(
  now: Date,
  approachingAt: Date,
  dueAt: Date,
  completedAt: Date | null,
): "ACTIVE" | "APPROACHING" | "BREACHED" | "COMPLETED" {
  if (completedAt) return "COMPLETED";
  if (dueAt <= now) return "BREACHED";
  if (approachingAt <= now) return "APPROACHING";
  return "ACTIVE";
}

function earliestOutstandingDue(state: {
  readonly firstResponseCompletedAt: Date | null;
  readonly firstResponseDueAt: Date;
  readonly resolutionCompletedAt: Date | null;
  readonly resolutionDueAt: Date;
}): Date {
  const due = [
    ...(state.firstResponseCompletedAt ? [] : [state.firstResponseDueAt]),
    ...(state.resolutionCompletedAt ? [] : [state.resolutionDueAt]),
  ].sort((left, right) => left.getTime() - right.getTime());
  return due[0] ?? state.resolutionDueAt;
}

function readAggregateCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "_all" in value) {
    const count = (value as { readonly _all?: unknown })._all;
    if (typeof count === "number") return count;
  }
  throw new TypeError("Ticket aggregate count is invalid.");
}
