import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { SlaPolicyService } from "../application/sla-policy.service.js";
import { decodeSlaPolicyWrite } from "./sla-contracts.js";

@ApiTags("sla")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/sla")
export class SlaController {
  public constructor(private readonly policies: SlaPolicyService) {}

  @Get("policy")
  @ApiOperation({ summary: "Read the active tenant's versioned wall-clock SLA policy" })
  public getPolicy(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.policies.get(identity);
  }

  @Put("policy")
  @ApiOperation({ summary: "Create or replace the active tenant's SLA policy" })
  public savePolicy(@CurrentIdentity() identity: AuthenticatedIdentity, @Body() body: unknown) {
    return this.policies.save(identity, decodeSlaPolicyWrite(body));
  }
}
