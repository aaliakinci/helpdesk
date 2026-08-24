import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { OperationsQueryService } from "../application/operations-query.service.js";
import { decodeWorkloadQuery } from "./support-contracts.js";

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/operations")
export class OperationsController {
  public constructor(private readonly queries: OperationsQueryService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Read SQL-backed ticket and queue operational summary" })
  public dashboard(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.queries.dashboard(identity);
  }

  @Get("agent-workload")
  @ApiOperation({ summary: "Read active queue-member workload" })
  public workload(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Query() query: Readonly<Record<string, unknown>>,
  ) {
    return this.queries.agentWorkload(identity, decodeWorkloadQuery(query));
  }
}
