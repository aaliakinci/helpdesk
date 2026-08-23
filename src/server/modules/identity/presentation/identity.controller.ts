import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { AuthenticatedIdentity } from "../domain/identity.types.js";
import { AccessTokenGuard, CurrentIdentity } from "./identity-http.js";

@ApiTags("identity")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller("api/v1/identity")
export class IdentityController {
  @Get("me")
  @ApiOperation({ summary: "Read the server-derived active identity and tenant context" })
  public me(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return {
      activeTenant: {
        id: identity.tenantId,
        name: identity.tenantName,
        permissions: identity.permissions,
        role: identity.role,
        slug: identity.tenantSlug,
        timeZone: identity.tenantTimeZone,
      },
      membershipId: identity.membershipId,
      requesterContactId: identity.customerContactId,
      user: { displayName: identity.displayName, email: identity.email, id: identity.userId },
    };
  }
}
