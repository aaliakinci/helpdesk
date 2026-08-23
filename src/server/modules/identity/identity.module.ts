import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { IdentityService } from "./application/identity.service.js";
import { AccessTokenService } from "./security/access-token.js";
import { LoginRateLimiter } from "./security/login-rate-limiter.js";
import { PasswordHasher } from "./security/password-hasher.js";
import { RefreshTokenService } from "./security/refresh-token.js";
import { AuthController } from "./presentation/auth.controller.js";
import { IdentityController } from "./presentation/identity.controller.js";
import { AccessTokenGuard, PermissionGuard } from "./presentation/identity-http.js";
import { MembershipsController } from "./presentation/memberships.controller.js";

@Module({
  imports: [PlatformModule],
  controllers: [AuthController, IdentityController, MembershipsController],
  providers: [
    AccessTokenGuard,
    AccessTokenService,
    IdentityService,
    LoginRateLimiter,
    PasswordHasher,
    PermissionGuard,
    RefreshTokenService,
  ],
  exports: [IdentityService, PasswordHasher],
})
export class IdentityModule {}
