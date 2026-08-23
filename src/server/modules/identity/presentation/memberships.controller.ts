import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { IdentityService } from "../application/identity.service.js";
import type { AuthenticatedIdentity } from "../domain/identity.types.js";
import { decodeRoleInput, decodeStatusInput, requireUuid } from "./identity-contracts.js";
import {
  AccessTokenGuard,
  CurrentIdentity,
  PermissionGuard,
  RequirePermission,
} from "./identity-http.js";

@ApiTags("memberships")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, PermissionGuard)
@RequirePermission("memberships.read")
@Controller("api/v1/memberships")
export class MembershipsController {
  public constructor(private readonly identityService: IdentityService) {}

  @Get()
  @ApiOperation({ summary: "List memberships in the active tenant" })
  public list(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.identityService.listMemberships(identity);
  }

  @Get(":membershipId")
  @ApiOperation({ summary: "Read a membership in the active tenant" })
  public get(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("membershipId") membershipId: string,
  ) {
    return this.identityService.getMembership(identity, requireUuid(membershipId));
  }

  @Patch(":membershipId/role")
  @RequirePermission("memberships.manage-role")
  @ApiOperation({ summary: "Assign a fixed role to an active-tenant membership" })
  public changeRole(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ) {
    return this.identityService.changeRole(
      identity,
      requireUuid(membershipId),
      decodeRoleInput(body).role,
    );
  }

  @Patch(":membershipId/status")
  @RequirePermission("memberships.manage-status")
  @ApiOperation({ summary: "Activate or disable an active-tenant membership" })
  public changeStatus(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ) {
    return this.identityService.changeStatus(
      identity,
      requireUuid(membershipId),
      decodeStatusInput(body).status,
    );
  }
}
