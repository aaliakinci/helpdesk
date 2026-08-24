import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type {
  Prisma,
  TicketAssignmentAction,
} from "../../../platform/database/generated/client.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import { selectNextRoundRobinMember } from "../domain/round-robin-policy.js";
import type { TicketDetail } from "./support.types.js";
import { SupportEventWriter } from "./support-event-writer.service.js";
import { TicketQueryService } from "./ticket-query.service.js";

type MutableTicket = Awaited<ReturnType<Prisma.TransactionClient["ticket"]["findUnique"]>>;

@Injectable()
export class AssignmentCommandService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: SupportEventWriter,
    private readonly ticketQueries: TicketQueryService,
  ) {}

  public async setQueue(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: { readonly expectedVersion: number; readonly queueId: string },
  ): Promise<TicketDetail> {
    this.assertManageQueues(identity);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findTicket(transaction, identity, ticketId);
      await this.assertActiveQueue(transaction, identity.tenantId, input.queueId);
      await this.applyAssignment(transaction, identity, ticket, {
        action: "QUEUED",
        expectedVersion: input.expectedVersion,
        toAssigneeMembershipId: null,
        toQueueId: input.queueId,
      });
    });
    return this.ticketQueries.getTicket(identity, ticketId);
  }

  public async assign(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: {
      readonly assigneeMembershipId: string;
      readonly expectedVersion: number;
      readonly queueId: string;
    },
  ): Promise<TicketDetail> {
    this.assertManageQueues(identity);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findTicket(transaction, identity, ticketId);
      await this.assertEligibleQueueMember(
        transaction,
        identity.tenantId,
        input.queueId,
        input.assigneeMembershipId,
      );
      await this.applyAssignment(transaction, identity, ticket, {
        action: "ASSIGNED",
        expectedVersion: input.expectedVersion,
        toAssigneeMembershipId: input.assigneeMembershipId,
        toQueueId: input.queueId,
      });
    });
    return this.ticketQueries.getTicket(identity, ticketId);
  }

  public async unassign(
    identity: AuthenticatedIdentity,
    ticketId: string,
    expectedVersion: number,
  ): Promise<TicketDetail> {
    this.assertManageQueues(identity);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findTicket(transaction, identity, ticketId);
      if (!ticket.currentAssigneeMembershipId) {
        throw new ConflictException("Ticket is already unassigned.");
      }
      await this.applyAssignment(transaction, identity, ticket, {
        action: "UNASSIGNED",
        expectedVersion,
        toAssigneeMembershipId: null,
        toQueueId: ticket.currentQueueId,
      });
    });
    return this.ticketQueries.getTicket(identity, ticketId);
  }

  public async takeOver(
    identity: AuthenticatedIdentity,
    ticketId: string,
    expectedVersion: number,
  ): Promise<TicketDetail> {
    if (identity.role !== "AGENT" || !hasPermission(identity.role, "tickets.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findTicket(transaction, identity, ticketId);
      if (!ticket.currentQueueId) throw new ConflictException("Ticket has no queue.");
      await this.assertEligibleQueueMember(
        transaction,
        identity.tenantId,
        ticket.currentQueueId,
        identity.membershipId,
      );
      if (ticket.currentAssigneeMembershipId === identity.membershipId) {
        throw new ConflictException("Ticket is already assigned to this agent.");
      }
      await this.applyAssignment(transaction, identity, ticket, {
        action: "TAKEN_OVER",
        expectedVersion,
        toAssigneeMembershipId: identity.membershipId,
        toQueueId: ticket.currentQueueId,
      });
    });
    return this.ticketQueries.getTicket(identity, ticketId);
  }

  public async assignRoundRobin(
    identity: AuthenticatedIdentity,
    ticketId: string,
    input: { readonly expectedVersion: number; readonly queueId: string },
  ): Promise<TicketDetail> {
    this.assertManageQueues(identity);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await this.findTicket(transaction, identity, ticketId);
      await this.assertActiveQueue(transaction, identity.tenantId, input.queueId);
      await transaction.queueAssignmentState.upsert({
        create: { queueId: input.queueId, tenantId: identity.tenantId },
        update: {},
        where: {
          tenantId_queueId: { queueId: input.queueId, tenantId: identity.tenantId },
        },
      });
      const locked = await transaction.$queryRaw<
        readonly { last_assigned_membership_id: string | null }[]
      >`
        SELECT "last_assigned_membership_id"
        FROM "queue_assignment_states"
        WHERE "tenant_id" = CAST(${identity.tenantId} AS UUID)
          AND "queue_id" = CAST(${input.queueId} AS UUID)
        FOR UPDATE
      `;
      const candidates = await transaction.queueMember.findMany({
        where: {
          membership: { role: "AGENT", status: "ACTIVE" },
          queueId: input.queueId,
          status: "ACTIVE",
          tenantId: identity.tenantId,
        },
        orderBy: { membershipId: "asc" },
        select: { membershipId: true },
      });
      const nextMembershipId = selectNextRoundRobinMember(
        candidates.map((candidate) => candidate.membershipId),
        locked[0]?.last_assigned_membership_id ?? null,
      );
      if (!nextMembershipId) {
        throw new ConflictException("Queue has no active agent members.");
      }
      await this.applyAssignment(transaction, identity, ticket, {
        action: "ROUND_ROBIN_ASSIGNED",
        expectedVersion: input.expectedVersion,
        toAssigneeMembershipId: nextMembershipId,
        toQueueId: input.queueId,
      });
      await transaction.queueAssignmentState.update({
        data: {
          lastAssignedMembershipId: nextMembershipId,
          version: { increment: 1 },
        },
        where: {
          tenantId_queueId: { queueId: input.queueId, tenantId: identity.tenantId },
        },
      });
    });
    return this.ticketQueries.getTicket(identity, ticketId);
  }

  private async applyAssignment(
    transaction: Prisma.TransactionClient,
    identity: AuthenticatedIdentity,
    ticket: NonNullable<MutableTicket>,
    input: {
      readonly action: TicketAssignmentAction;
      readonly expectedVersion: number;
      readonly toAssigneeMembershipId: string | null;
      readonly toQueueId: string | null;
    },
  ): Promise<void> {
    if (ticket.status === "CLOSED") throw new ConflictException("Closed tickets are immutable.");
    if (ticket.version !== input.expectedVersion) {
      throw new ConflictException("Ticket revision is stale.");
    }
    if (
      ticket.currentQueueId === input.toQueueId &&
      ticket.currentAssigneeMembershipId === input.toAssigneeMembershipId
    ) {
      throw new ConflictException("Ticket assignment is unchanged.");
    }
    const nextVersion = input.expectedVersion + 1;
    const updated = await transaction.ticket.updateMany({
      where: {
        id: ticket.id,
        tenantId: identity.tenantId,
        version: input.expectedVersion,
      },
      data: {
        assignedAt: input.toAssigneeMembershipId ? new Date() : null,
        currentAssigneeMembershipId: input.toAssigneeMembershipId,
        currentQueueId: input.toQueueId,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ConflictException("Ticket revision is stale.");
    await transaction.ticketAssignment.create({
      data: {
        action: input.action,
        actorUserId: identity.userId,
        fromAssigneeMembershipId: ticket.currentAssigneeMembershipId,
        fromQueueId: ticket.currentQueueId,
        tenantId: identity.tenantId,
        ticketId: ticket.id,
        toAssigneeMembershipId: input.toAssigneeMembershipId,
        toQueueId: input.toQueueId,
        version: nextVersion,
      },
    });
    const metadata = compactAssignmentData({
      action: input.action,
      fromAssigneeMembershipId: ticket.currentAssigneeMembershipId,
      fromQueueId: ticket.currentQueueId,
      toAssigneeMembershipId: input.toAssigneeMembershipId,
      toQueueId: input.toQueueId,
    });
    await this.events.write(transaction, identity, {
      action: "ticket.assignment.changed",
      aggregateId: ticket.id,
      aggregateType: "ticket",
      eventType: "ticket.assignment-changed.v1",
      metadata,
      payload: {
        ...metadata,
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        version: nextVersion,
      },
    });
  }

  private async findTicket(
    transaction: Prisma.TransactionClient,
    identity: AuthenticatedIdentity,
    ticketId: string,
  ): Promise<NonNullable<MutableTicket>> {
    const ticket = await transaction.ticket.findUnique({
      where: { tenantId_id: { id: ticketId, tenantId: identity.tenantId } },
    });
    if (!ticket) throw new NotFoundException("Ticket was not found.");
    return ticket;
  }

  private async assertActiveQueue(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    queueId: string,
  ): Promise<void> {
    const queue = await transaction.queue.findFirst({
      where: { id: queueId, status: "ACTIVE", tenantId },
      select: { id: true },
    });
    if (!queue) throw new NotFoundException("Active queue was not found.");
  }

  private async assertEligibleQueueMember(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    queueId: string,
    membershipId: string,
  ): Promise<void> {
    await this.assertActiveQueue(transaction, tenantId, queueId);
    const member = await transaction.queueMember.findFirst({
      where: {
        membership: { role: "AGENT", status: "ACTIVE" },
        membershipId,
        queueId,
        status: "ACTIVE",
        tenantId,
      },
      select: { membershipId: true },
    });
    if (!member) throw new NotFoundException("Active queue member was not found.");
  }

  private assertManageQueues(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "queues.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

function compactAssignmentData(input: {
  readonly action: TicketAssignmentAction;
  readonly fromAssigneeMembershipId: string | null;
  readonly fromQueueId: string | null;
  readonly toAssigneeMembershipId: string | null;
  readonly toQueueId: string | null;
}): Readonly<Record<string, string>> {
  return {
    action: input.action,
    ...(input.fromAssigneeMembershipId
      ? { fromAssigneeMembershipId: input.fromAssigneeMembershipId }
      : {}),
    ...(input.fromQueueId ? { fromQueueId: input.fromQueueId } : {}),
    ...(input.toAssigneeMembershipId
      ? { toAssigneeMembershipId: input.toAssigneeMembershipId }
      : {}),
    ...(input.toQueueId ? { toQueueId: input.toQueueId } : {}),
  };
}
