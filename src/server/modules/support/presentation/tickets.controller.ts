import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { AssignmentCommandService } from "../application/assignment-command.service.js";
import { TicketCommandService } from "../application/ticket-command.service.js";
import { TicketQueryService } from "../application/ticket-query.service.js";
import {
  decodeCommentWrite,
  decodeCreateTicket,
  decodeExpectedVersion,
  decodeManualAssignmentWrite,
  decodeQueueAssignmentWrite,
  decodeStatusWrite,
  decodeTicketListQuery,
  requireUuid,
} from "./support-contracts.js";

@ApiTags("tickets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/tickets")
export class TicketsController {
  public constructor(
    private readonly assignments: AssignmentCommandService,
    private readonly commands: TicketCommandService,
    private readonly queries: TicketQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List role-projected active-tenant tickets" })
  public list(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Query() query: Readonly<Record<string, unknown>>,
  ) {
    return this.queries.listTickets(identity, decodeTicketListQuery(query));
  }

  @Post()
  @ApiOperation({ summary: "Create a ticket with history, audit, and durable outbox" })
  public create(@CurrentIdentity() identity: AuthenticatedIdentity, @Body() body: unknown) {
    return this.commands.createTicket(identity, decodeCreateTicket(body));
  }

  @Get(":ticketId")
  @ApiOperation({ summary: "Read a role-projected ticket detail" })
  public get(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
  ) {
    return this.queries.getTicket(identity, requireUuid(ticketId));
  }

  @Post(":ticketId/comments")
  @ApiOperation({ summary: "Add a public reply or staff-only internal note" })
  public comment(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.commands.addComment(identity, requireUuid(ticketId), decodeCommentWrite(body));
  }

  @Patch(":ticketId/status")
  @ApiOperation({ summary: "Transition ticket status with expected-version protection" })
  public changeStatus(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.commands.changeStatus(identity, requireUuid(ticketId), decodeStatusWrite(body));
  }

  @Post(":ticketId/reopen")
  @ApiOperation({ summary: "Reopen resolved ticket or create a linked ticket from closed" })
  public reopen(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.commands.reopenTicket(identity, requireUuid(ticketId), decodeExpectedVersion(body));
  }

  @Post(":ticketId/queue")
  @ApiOperation({ summary: "Place a ticket in an active queue" })
  public setQueue(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.assignments.setQueue(
      identity,
      requireUuid(ticketId),
      decodeQueueAssignmentWrite(body),
    );
  }

  @Post(":ticketId/assign")
  @ApiOperation({ summary: "Manually assign a ticket to an active queue member" })
  public assign(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.assignments.assign(
      identity,
      requireUuid(ticketId),
      decodeManualAssignmentWrite(body),
    );
  }

  @Post(":ticketId/unassign")
  @ApiOperation({ summary: "Remove the current assignee while retaining the queue" })
  public unassign(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.assignments.unassign(identity, requireUuid(ticketId), decodeExpectedVersion(body));
  }

  @Post(":ticketId/take-over")
  @ApiOperation({ summary: "Assign an accessible queue ticket to the current Agent" })
  public takeOver(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.assignments.takeOver(identity, requireUuid(ticketId), decodeExpectedVersion(body));
  }

  @Post(":ticketId/round-robin")
  @ApiOperation({ summary: "Assign a ticket using the queue's locked round-robin cursor" })
  public roundRobin(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    return this.assignments.assignRoundRobin(
      identity,
      requireUuid(ticketId),
      decodeQueueAssignmentWrite(body),
    );
  }
}
