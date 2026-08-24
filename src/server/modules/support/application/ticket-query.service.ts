import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import type { TicketDetail, TicketListInput, TicketPage, TicketSummary } from "./support.types.js";
import { ticketReadScope } from "./ticket-access.js";

const requesterSelect = {
  customerId: true,
  displayName: true,
  email: true,
  id: true,
  customer: { select: { name: true } },
} satisfies Prisma.CustomerContactSelect;

const summarySelect = {
  assignedAt: true,
  createdAt: true,
  currentAssignee: { select: { id: true, user: { select: { displayName: true } } } },
  currentQueue: { select: { id: true, name: true } },
  firstResponseAt: true,
  id: true,
  number: true,
  priority: true,
  requesterContact: { select: requesterSelect },
  status: true,
  subject: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.TicketSelect;

type TicketSummaryRecord = Prisma.TicketGetPayload<{ select: typeof summarySelect }>;

@Injectable()
export class TicketQueryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async listTickets(
    identity: AuthenticatedIdentity,
    input: TicketListInput,
  ): Promise<TicketPage> {
    const scope = ticketReadScope(identity);
    const where: Prisma.TicketWhereInput = {
      AND: [
        scope,
        ...(input.assignment === "MINE"
          ? [{ currentAssigneeMembershipId: identity.membershipId }]
          : input.assignment === "UNASSIGNED"
            ? [{ currentAssigneeMembershipId: null }]
            : []),
        ...(input.search
          ? [
              {
                OR: [
                  { subject: { contains: input.search, mode: "insensitive" as const } },
                  { description: { contains: input.search, mode: "insensitive" as const } },
                  {
                    requesterContact: {
                      is: {
                        OR: [
                          { displayName: { contains: input.search, mode: "insensitive" as const } },
                          { email: { contains: input.search, mode: "insensitive" as const } },
                          {
                            customer: {
                              is: {
                                name: { contains: input.search, mode: "insensitive" as const },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                  ...(/^[1-9][0-9]*$/u.test(input.search)
                    ? [{ number: Number(input.search) }]
                    : []),
                ],
              },
            ]
          : []),
      ],
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.queueId ? { currentQueueId: input.queueId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const orderBy: Prisma.TicketOrderByWithRelationInput = {
      [input.sortBy]: input.sortDirection,
    };
    const [total, tickets] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy: [orderBy, { id: input.sortDirection }],
        select: summarySelect,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: tickets.map((ticket) => toTicketSummary(ticket, identity.role !== "REQUESTER")),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  public async getTicket(identity: AuthenticatedIdentity, ticketId: string): Promise<TicketDetail> {
    const scope = ticketReadScope(identity);
    const isRequester = identity.role === "REQUESTER";
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        AND: [scope],
        id: ticketId,
      },
      select: {
        ...summarySelect,
        assignmentHistory: {
          orderBy: [{ version: "asc" }, { id: "asc" }],
          select: {
            action: true,
            actor: { select: { displayName: true, id: true } },
            fromAssignee: {
              select: { id: true, user: { select: { displayName: true } } },
            },
            fromQueue: { select: { id: true, name: true } },
            id: true,
            occurredAt: true,
            toAssignee: {
              select: { id: true, user: { select: { displayName: true } } },
            },
            toQueue: { select: { id: true, name: true } },
            version: true,
          },
        },
        closedAt: true,
        comments: {
          ...(isRequester ? { where: { visibility: "PUBLIC" as const } } : {}),
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            author: { select: { displayName: true, id: true } },
            body: true,
            createdAt: true,
            id: true,
            visibility: true,
          },
        },
        description: true,
        reopenedFrom: { select: { id: true, number: true } },
        reopenedTickets: { orderBy: { number: "asc" }, select: { id: true, number: true } },
        resolvedAt: true,
        statusHistory: {
          orderBy: [{ version: "asc" }, { id: "asc" }],
          select: {
            actor: { select: { displayName: true, id: true } },
            fromStatus: true,
            id: true,
            occurredAt: true,
            toStatus: true,
            version: true,
          },
        },
        tags: {
          orderBy: { tag: { name: "asc" } },
          select: { tag: { select: { id: true, name: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket was not found.");

    return {
      ...toTicketSummary(ticket, !isRequester),
      assignmentHistory: isRequester
        ? []
        : ticket.assignmentHistory.map((entry) => ({
            action: entry.action,
            actor: entry.actor,
            fromAssignee: entry.fromAssignee
              ? {
                  displayName: entry.fromAssignee.user.displayName,
                  membershipId: entry.fromAssignee.id,
                }
              : null,
            fromQueue: entry.fromQueue,
            id: entry.id,
            occurredAtUtc: entry.occurredAt.toISOString(),
            toAssignee: entry.toAssignee
              ? {
                  displayName: entry.toAssignee.user.displayName,
                  membershipId: entry.toAssignee.id,
                }
              : null,
            toQueue: entry.toQueue,
            version: entry.version,
          })),
      closedAtUtc: ticket.closedAt?.toISOString() ?? null,
      comments: ticket.comments.map((comment) => ({
        author: comment.author,
        body: comment.body,
        createdAtUtc: comment.createdAt.toISOString(),
        id: comment.id,
        visibility: comment.visibility,
      })),
      description: ticket.description,
      reopenedFrom: ticket.reopenedFrom,
      reopenedTickets: ticket.reopenedTickets,
      resolvedAtUtc: ticket.resolvedAt?.toISOString() ?? null,
      statusHistory: isRequester
        ? []
        : ticket.statusHistory.map((entry) => ({
            actor: entry.actor,
            fromStatus: entry.fromStatus,
            id: entry.id,
            occurredAtUtc: entry.occurredAt.toISOString(),
            toStatus: entry.toStatus,
            version: entry.version,
          })),
      tags: ticket.tags.map(({ tag }) => tag),
    };
  }
}

function toTicketSummary(ticket: TicketSummaryRecord, includeOperations: boolean): TicketSummary {
  return {
    assignedAtUtc: includeOperations ? (ticket.assignedAt?.toISOString() ?? null) : null,
    assignee:
      includeOperations && ticket.currentAssignee
        ? {
            displayName: ticket.currentAssignee.user.displayName,
            membershipId: ticket.currentAssignee.id,
          }
        : null,
    createdAtUtc: ticket.createdAt.toISOString(),
    firstResponseAtUtc: ticket.firstResponseAt?.toISOString() ?? null,
    id: ticket.id,
    number: ticket.number,
    priority: ticket.priority,
    queue: includeOperations ? ticket.currentQueue : null,
    requester: {
      contactId: ticket.requesterContact.id,
      customerId: ticket.requesterContact.customerId,
      customerName: ticket.requesterContact.customer.name,
      displayName: ticket.requesterContact.displayName,
      email: ticket.requesterContact.email,
    },
    status: ticket.status,
    subject: ticket.subject,
    updatedAtUtc: ticket.updatedAt.toISOString(),
    version: ticket.version,
  };
}
