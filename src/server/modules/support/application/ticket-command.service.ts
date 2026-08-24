import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import { SlaLifecycleService } from "../../sla/index.js";
import {
  canTransitionTicket,
  type TicketCommentVisibility,
  type TicketPriority,
  type TicketStatus,
} from "../domain/ticket-policy.js";
import type { TicketDetail } from "./support.types.js";
import { SupportEventWriter } from "./support-event-writer.service.js";
import { ticketReadScope } from "./ticket-access.js";
import { TicketQueryService } from "./ticket-query.service.js";

@Injectable()
export class TicketCommandService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: SupportEventWriter,
    private readonly queries: TicketQueryService,
    private readonly sla: SlaLifecycleService,
  ) {}

  public async createTicket(
    identity: AuthenticatedIdentity,
    input: {
      readonly description: string;
      readonly priority: TicketPriority;
      readonly requesterContactId: string | null;
      readonly subject: string;
    },
  ): Promise<TicketDetail> {
    if (!hasPermission(identity.role, "tickets.create")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const ticketId = await this.prisma.$transaction(async (transaction) => {
      const requesterContactId = await this.resolveRequesterContact(
        transaction,
        identity,
        input.requesterContactId,
      );
      const ticket = await this.createTicketGraph(transaction, identity, {
        description: input.description,
        priority: input.priority,
        reopenedFromTicketId: null,
        requesterContactId,
        subject: input.subject,
      });
      return ticket.id;
    });
    return this.queries.getTicket(identity, ticketId);
  }

  public async addComment(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: {
      readonly body: string;
      readonly expectedVersion: number;
      readonly visibility: TicketCommentVisibility;
    },
  ): Promise<TicketDetail> {
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findMutableTicket(transaction, identity, ticketId);
      const isRequester = identity.role === "REQUESTER";
      if (isRequester) {
        if (input.visibility !== "PUBLIC") {
          throw new ForbiddenException("Requester comments must be public.");
        }
      } else if (!hasPermission(identity.role, "tickets.manage")) {
        throw new ForbiddenException("The operation is not permitted.");
      }
      if (ticket.status === "CLOSED") {
        throw new ConflictException("Closed tickets are immutable.");
      }

      const now = new Date();
      const nextVersion = input.expectedVersion + 1;
      const firstResponseAt =
        (identity.role === "AGENT" || identity.role === "MANAGER") &&
        input.visibility === "PUBLIC" &&
        ticket.firstResponseAt === null
          ? now
          : undefined;
      const advanced = await transaction.ticket.updateMany({
        where: { id: ticket.id, tenantId: identity.tenantId, version: input.expectedVersion },
        data: {
          ...(firstResponseAt ? { firstResponseAt } : {}),
          version: { increment: 1 },
        },
      });
      if (advanced.count !== 1) throw new ConflictException("Ticket revision is stale.");
      if (firstResponseAt) {
        await this.sla.completeFirstResponse(
          transaction,
          identity.tenantId,
          ticket.id,
          firstResponseAt,
        );
      }

      const comment = await transaction.ticketComment.create({
        data: {
          authorUserId: identity.userId,
          body: input.body,
          tenantId: identity.tenantId,
          ticketId: ticket.id,
          visibility: input.visibility,
        },
      });
      await this.events.write(transaction, identity, {
        action:
          input.visibility === "INTERNAL" ? "ticket.internal-note.added" : "ticket.reply.added",
        aggregateId: ticket.id,
        aggregateType: "ticket",
        eventType: "ticket.comment.added.v1",
        metadata: { commentId: comment.id, visibility: input.visibility },
        payload: {
          commentId: comment.id,
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          version: nextVersion,
          visibility: input.visibility,
        },
      });
    });
    return this.queries.getTicket(identity, ticketId);
  }

  public async changeStatus(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: { readonly expectedVersion: number; readonly status: TicketStatus },
  ): Promise<TicketDetail> {
    this.assertManage(identity);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findMutableTicket(transaction, identity, ticketId);
      if (!canTransitionTicket(ticket.status, input.status)) {
        throw new ConflictException("Ticket status transition is not allowed.");
      }
      const now = new Date();
      const nextVersion = input.expectedVersion + 1;
      const advanced = await transaction.ticket.updateMany({
        where: { id: ticket.id, tenantId: identity.tenantId, version: input.expectedVersion },
        data: {
          closedAt: input.status === "CLOSED" ? now : null,
          resolvedAt:
            input.status === "RESOLVED"
              ? now
              : ticket.status === "RESOLVED" && input.status === "OPEN"
                ? null
                : ticket.resolvedAt,
          status: input.status,
          version: { increment: 1 },
        },
      });
      if (advanced.count !== 1) throw new ConflictException("Ticket revision is stale.");
      if (input.status === "RESOLVED") {
        await this.sla.completeResolution(transaction, identity.tenantId, ticket.id, now);
      } else if (ticket.status === "RESOLVED") {
        await this.sla.cancelAutoClose(transaction, identity.tenantId, ticket.id);
      }
      await transaction.ticketStatusHistory.create({
        data: {
          actorUserId: identity.userId,
          fromStatus: ticket.status,
          tenantId: identity.tenantId,
          ticketId: ticket.id,
          toStatus: input.status,
          version: nextVersion,
        },
      });
      await this.events.write(transaction, identity, {
        action: "ticket.status.changed",
        aggregateId: ticket.id,
        aggregateType: "ticket",
        eventType: "ticket.status-changed.v1",
        metadata: { from: ticket.status, to: input.status },
        payload: {
          fromStatus: ticket.status,
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          toStatus: input.status,
          version: nextVersion,
        },
      });
    });
    return this.queries.getTicket(identity, ticketId);
  }

  public async reopenTicket(
    identity: AuthenticatedIdentity,
    ticketId: string,
    expectedVersion: number,
  ): Promise<TicketDetail> {
    this.assertManage(identity);
    const source = await this.prisma.ticket.findFirst({
      where: { AND: [ticketReadScope(identity)], id: ticketId },
    });
    if (!source) throw new NotFoundException("Ticket was not found.");
    if (source.version !== expectedVersion)
      throw new ConflictException("Ticket revision is stale.");
    if (source.status === "RESOLVED") {
      return this.changeStatus(identity, ticketId, { expectedVersion, status: "OPEN" });
    }
    if (source.status !== "CLOSED") {
      throw new ConflictException("Only resolved or closed tickets can be reopened.");
    }

    try {
      const reopenedId = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.ticket.findFirst({
          where: { AND: [ticketReadScope(identity)], id: ticketId },
        });
        if (!current) throw new NotFoundException("Ticket was not found.");
        if (current.version !== expectedVersion) {
          throw new ConflictException("Ticket revision is stale.");
        }
        if (current.status !== "CLOSED") {
          throw new ConflictException("Only a closed ticket creates a linked reopen.");
        }
        const reopened = await this.createTicketGraph(transaction, identity, {
          description: current.description,
          priority: current.priority,
          reopenedFromTicketId: current.id,
          requesterContactId: current.requesterContactId,
          subject: current.subject,
        });
        return reopened.id;
      });
      return this.queries.getTicket(identity, reopenedId);
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("The closed ticket has already been reopened.");
      }
      throw error;
    }
  }

  private async createTicketGraph(
    transaction: Prisma.TransactionClient,
    identity: AuthenticatedIdentity,
    input: {
      readonly description: string;
      readonly priority: TicketPriority;
      readonly reopenedFromTicketId: string | null;
      readonly requesterContactId: string;
      readonly subject: string;
    },
  ) {
    const number = await allocateTicketNumber(transaction, identity.tenantId);
    const ticket = await transaction.ticket.create({
      data: {
        createdByUserId: identity.userId,
        description: input.description,
        number,
        priority: input.priority,
        reopenedFromTicketId: input.reopenedFromTicketId,
        requesterContactId: input.requesterContactId,
        subject: input.subject,
        tenantId: identity.tenantId,
      },
    });
    await this.sla.createForTicket(transaction, {
      createdAt: ticket.createdAt,
      priority: ticket.priority,
      tenantId: identity.tenantId,
      ticketId: ticket.id,
    });
    await transaction.ticketStatusHistory.create({
      data: {
        actorUserId: identity.userId,
        fromStatus: null,
        tenantId: identity.tenantId,
        ticketId: ticket.id,
        toStatus: "NEW",
        version: 1,
      },
    });
    await this.events.write(transaction, identity, {
      action: input.reopenedFromTicketId ? "ticket.reopened" : "ticket.created",
      aggregateId: ticket.id,
      aggregateType: "ticket",
      eventType: "ticket.created.v1",
      metadata: input.reopenedFromTicketId
        ? { reopenedFromTicketId: input.reopenedFromTicketId }
        : null,
      payload: {
        priority: ticket.priority,
        ...(input.reopenedFromTicketId ? { reopenedFromTicketId: input.reopenedFromTicketId } : {}),
        status: ticket.status,
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        version: ticket.version,
      },
    });
    return ticket;
  }

  private async resolveRequesterContact(
    transaction: Prisma.TransactionClient,
    identity: AuthenticatedIdentity,
    requestedContactId: string | null,
  ): Promise<string> {
    const contactId =
      identity.role === "REQUESTER" ? identity.customerContactId : requestedContactId;
    if (!contactId) throw new NotFoundException("Requester contact was not found.");
    if (
      identity.role === "REQUESTER" &&
      requestedContactId !== null &&
      requestedContactId !== identity.customerContactId
    ) {
      throw new NotFoundException("Requester contact was not found.");
    }
    const contact = await transaction.customerContact.findUnique({
      where: { tenantId_id: { tenantId: identity.tenantId, id: contactId } },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException("Requester contact was not found.");
    return contact.id;
  }

  private async findMutableTicket(
    transaction: Prisma.TransactionClient,
    identity: AuthenticatedIdentity,
    ticketId: string,
  ) {
    const ticket = await transaction.ticket.findFirst({
      where: {
        AND: [ticketReadScope(identity)],
        id: ticketId,
      },
    });
    if (!ticket) throw new NotFoundException("Ticket was not found.");
    return ticket;
  }

  private assertManage(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "tickets.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

async function allocateTicketNumber(
  transaction: Prisma.TransactionClient,
  tenantId: string,
): Promise<number> {
  const rows = await transaction.$queryRaw<readonly { last_number: number }[]>`
    INSERT INTO "tenant_ticket_counters" ("tenant_id", "last_number", "updated_at")
    VALUES (CAST(${tenantId} AS UUID), 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("tenant_id") DO UPDATE
    SET "last_number" = "tenant_ticket_counters"."last_number" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    RETURNING "last_number"
  `;
  const number = rows[0]?.last_number;
  if (!number || number < 1) throw new Error("Ticket number allocation failed.");
  return number;
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}
