import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { PlatformConfigService } from "../../../platform/index.js";
import { IdentityService } from "../application/identity.service.js";
import type { AuthenticatedIdentity, AuthenticationResponse } from "../domain/identity.types.js";
import { RefreshTokenService } from "../security/refresh-token.js";
import { decodeLoginInput, decodeTenantSwitchInput } from "./identity-contracts.js";
import {
  AccessTokenGuard,
  CurrentIdentity,
  type IdentityHttpRequest,
  singleHeader,
} from "./identity-http.js";

interface CookieResponse {
  setHeader(name: string, value: string): void;
}

@ApiTags("authentication")
@Controller("api/v1/auth")
export class AuthController {
  public constructor(
    private readonly identityService: IdentityService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: PlatformConfigService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Authenticate and optionally select a tenant" })
  public async login(
    @Body() body: unknown,
    @Req() request: IdentityHttpRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthenticationResponse> {
    const input = decodeLoginInput(body);
    const envelope = await this.identityService.login({
      ...input,
      clientAddress: request.ip ?? request.socket?.remoteAddress ?? "unknown",
    });
    this.writeRefreshCookie(response, envelope.refreshToken, envelope.refreshExpiresAt);
    return envelope.body;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate the refresh token and issue a new access token" })
  public async refresh(
    @Headers("origin") origin: string | undefined,
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthenticationResponse> {
    this.assertTrustedOrigin(origin);
    const rawToken = this.refreshTokens.parseCookie(cookie);
    if (!rawToken) throw new UnauthorizedException("Refresh session is required.");
    const envelope = await this.identityService.refresh(rawToken);
    this.writeRefreshCookie(response, envelope.refreshToken, envelope.refreshExpiresAt);
    return envelope.body;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke the current refresh-token family" })
  public async logout(
    @Headers("origin") origin: string | undefined,
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    this.assertTrustedOrigin(origin);
    await this.identityService.logout(this.refreshTokens.parseCookie(cookie));
    response.setHeader("Set-Cookie", this.refreshTokens.clear());
  }

  @Post("revoke-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: "Revoke every active session for the authenticated user" })
  public async revokeAll(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.identityService.revokeAll(identity);
    response.setHeader("Set-Cookie", this.refreshTokens.clear());
  }

  @Post("switch-tenant")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: "Rotate the session into another active membership" })
  public async switchTenant(
    @Body() body: unknown,
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthenticationResponse> {
    const envelope = await this.identityService.switchTenant(
      identity,
      decodeTenantSwitchInput(body).tenantId,
    );
    this.writeRefreshCookie(response, envelope.refreshToken, envelope.refreshExpiresAt);
    return envelope.body;
  }

  @Get("tenants")
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: "List the caller's active tenant memberships" })
  public listTenants(@CurrentIdentity() identity: AuthenticatedIdentity) {
    return this.identityService.listTenants(identity);
  }

  private assertTrustedOrigin(originHeader: string | undefined): void {
    const origin = singleHeader(originHeader);
    if (origin !== this.config.values.webOrigin) {
      throw new ForbiddenException("Origin is not allowed.");
    }
  }

  private writeRefreshCookie(
    response: CookieResponse,
    token: string | null,
    expiresAt: Date | null,
  ): void {
    if (token && expiresAt)
      response.setHeader("Set-Cookie", this.refreshTokens.serialize(token, expiresAt));
  }
}
