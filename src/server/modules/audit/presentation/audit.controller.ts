import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "../../identity/presentation/identity-http.js";
import { AuditQueryService } from "../application/audit-query.service.js";
import { decodeAuditListQuery } from "./audit-contracts.js";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/audit")
export class AuditController {
  public constructor(private readonly audit: AuditQueryService) {}

  @Get()
  @ApiOperation({ summary: "List filtered, tenant-scoped, read-only audit entries" })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "actorType", required: false, enum: ["USER", "SYSTEM"] })
  @ApiQuery({ name: "actorUserId", required: false })
  @ApiQuery({ name: "aggregateType", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "to", required: false })
  public list(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Query() query: Readonly<Record<string, unknown>>,
  ) {
    return this.audit.list(identity, decodeAuditListQuery(query));
  }
}
