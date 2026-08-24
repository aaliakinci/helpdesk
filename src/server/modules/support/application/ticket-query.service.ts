import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import type { TicketDetail, TicketListInput, TicketPage, TicketSummary } from "./support.types.js";

const requesterSelect = {
  customerId: true,
  displayName: true,
  email: true,
  id: true,
  customer: { select: { name: true } },
} satisfies Prisma.CustomerContactSelect;

const summarySelect = {
  createdAt: true,
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
    const requesterContactId = this.authorizedRequesterContact(identity);
    const where: Prisma.TicketWhereInput = {
      tenantId: identity.tenantId,
      ...(requesterContactId ? { requesterContactId } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
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
      items: tickets.map(toTicketSummary),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  public async getTicket(identity: AuthenticatedIdentity, ticketId: string): Promise<TicketDetail> {
    const requesterContactId = this.authorizedRequesterContact(identity);
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId: identity.tenantId,
        ...(requesterContactId ? { requesterContactId } : {}),
      },
      select: {
        ...summarySelect,
        closedAt: true,
        comments: {
          ...(requesterContactId ? { where: { visibility: "PUBLIC" as const } } : {}),
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
      ...toTicketSummary(ticket),
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
      statusHistory: requesterContactId
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

  private authorizedRequesterContact(identity: AuthenticatedIdentity): string | null {
    if (identity.role === "REQUESTER") {
      if (!hasPermission(identity.role, "tickets.read-own") || !identity.customerContactId) {
        throw new ForbiddenException("The operation is not permitted.");
      }
      return identity.customerContactId;
    }
    if (!hasPermission(identity.role, "tickets.read")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    return null;
  }
}

function toTicketSummary(ticket: TicketSummaryRecord): TicketSummary {
  return {
    createdAtUtc: ticket.createdAt.toISOString(),
    firstResponseAtUtc: ticket.firstResponseAt?.toISOString() ?? null,
    id: ticket.id,
    number: ticket.number,
    priority: ticket.priority,
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
