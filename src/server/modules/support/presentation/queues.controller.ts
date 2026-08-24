import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { QueueCommandService } from "../application/queue-command.service.js";
import { QueueQueryService } from "../application/queue-query.service.js";
import {
  decodeCreateQueue,
  decodeQueueMemberWrite,
  decodeUpdateQueue,
  requireUuid,
} from "./support-contracts.js";

@ApiTags("queues")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/queues")
export class QueuesController {
  public constructor(
    private readonly commands: QueueCommandService,
    private readonly queries: QueueQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List active-tenant queues visible to the current role" })
  public list(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.queries.listQueues(identity);
  }

  @Post()
  @ApiOperation({ summary: "Create a queue and its round-robin cursor" })
  public create(@CurrentIdentity() identity: AuthenticatedIdentity, @Body() body: unknown) {
    return this.commands.createQueue(identity, decodeCreateQueue(body));
  }

  @Get("eligible-members")
  @ApiOperation({ summary: "List active Agent memberships eligible for queues" })
  public eligibleMembers(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.queries.listEligibleMembers(identity);
  }

  @Get(":queueId")
  @ApiOperation({ summary: "Read queue members and operational counts" })
  public get(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("queueId") queueId: string,
  ) {
    return this.queries.getQueue(identity, requireUuid(queueId));
  }

  @Patch(":queueId")
  @ApiOperation({ summary: "Update queue metadata with expected-version protection" })
  public update(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("queueId") queueId: string,
    @Body() body: unknown,
  ) {
    return this.commands.updateQueue(identity, requireUuid(queueId), decodeUpdateQueue(body));
  }

  @Post(":queueId/members")
  @ApiOperation({ summary: "Add, enable, or disable an Agent queue membership" })
  public setMember(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("queueId") queueId: string,
    @Body() body: unknown,
  ) {
    return this.commands.setMember(identity, requireUuid(queueId), decodeQueueMemberWrite(body));
  }
}
