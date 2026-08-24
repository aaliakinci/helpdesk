import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

import {
  PlatformConfigService,
  PrismaService,
  SessionInvalidationService,
} from "../../../platform/index.js";
import type {
  AuthenticatedIdentity,
  AuthenticationEnvelope,
  AuthenticationResponse,
  TenantOption,
} from "../domain/identity.types.js";
import {
  hasPermission,
  isTenantRole,
  permissionsForRole,
  type Permission,
  type TenantRole,
} from "../domain/permissions.js";
import { AccessTokenService } from "../security/access-token.js";
import { LoginRateLimiter } from "../security/login-rate-limiter.js";
import { PasswordHasher } from "../security/password-hasher.js";
import { RefreshTokenService } from "../security/refresh-token.js";

const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$XVVl3GIBODok1N8xBnFPAA$TffvcZ89sdtVGXloQJN0jfOAnYWI3eQIzYrdN0izlu9-tCX8HpLPbvhuc8Cg7S_MuU4p44yCcPusRBbROfghSQ";

interface MembershipView {
  readonly customerContactId: string | null;
  readonly id: string;
  readonly role: string;
  readonly tenant: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly status: string;
    readonly timeZone: string;
  };
  readonly tenantId: string;
  readonly userId: string;
}

interface UserView {
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly status: string;
}

@Injectable()
export class IdentityService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly loginRateLimiter: LoginRateLimiter,
    private readonly config: PlatformConfigService,
    @Optional() private readonly sessionInvalidations?: SessionInvalidationService,
  ) {}

  public async login(input: {
    readonly clientAddress: string;
    readonly email: string;
    readonly password: string;
    readonly tenantId: string | null;
  }): Promise<AuthenticationEnvelope> {
    const rateKey = this.loginRateLimiter.key(input.clientAddress, input.email);
    this.loginRateLimiter.assertAllowed(rateKey);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          where: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
          include: { tenant: true },
          orderBy: { tenant: { name: "asc" } },
        },
      },
    });
    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || user.status !== "ACTIVE" || !passwordMatches || user.memberships.length === 0) {
      this.loginRateLimiter.recordFailure(rateKey);
      throw new UnauthorizedException("Invalid credentials.");
    }

    const memberships = user.memberships.map((membership) => membership as MembershipView);
    if (!input.tenantId && memberships.length > 1) {
      this.loginRateLimiter.reset(rateKey);
      return {
        body: tenantSelectionResponse(memberships),
        refreshExpiresAt: null,
        refreshToken: null,
      };
    }

    const membership = input.tenantId
      ? memberships.find((candidate) => candidate.tenantId === input.tenantId)
      : memberships[0];
    if (!membership) {
      this.loginRateLimiter.recordFailure(rateKey);
      throw new UnauthorizedException("Invalid credentials.");
    }

    this.loginRateLimiter.reset(rateKey);
    return this.createSession(user, membership, memberships);
  }

  public async refresh(rawRefreshToken: string): Promise<AuthenticationEnvelope> {
    const nextToken = this.refreshTokens.create();
    const now = new Date();
    const currentHash = this.refreshTokens.hash(rawRefreshToken);
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.userSession.findUnique({
        where: { refreshTokenHash: currentHash },
        include: { user: true, membership: { include: { tenant: true } } },
      });
      if (!current) return { kind: "invalid" as const };

      const invalidState =
        current.revokedAt !== null ||
        current.lastUsedAt !== null ||
        current.expiresAt <= now ||
        current.user.status !== "ACTIVE" ||
        current.membership.status !== "ACTIVE" ||
        current.membership.tenant.status !== "ACTIVE";
      if (invalidState) {
        await transaction.userSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now, revokeReason: "refresh-token-reuse" },
        });
        return { kind: "invalid" as const };
      }

      const consumed = await transaction.userSession.updateMany({
        where: { id: current.id, lastUsedAt: null, revokedAt: null },
        data: { lastUsedAt: now, revokedAt: now, revokeReason: "rotated" },
      });
      if (consumed.count !== 1) {
        await transaction.userSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now, revokeReason: "refresh-token-reuse" },
        });
        return { kind: "invalid" as const };
      }

      const session = await transaction.userSession.create({
        data: {
          expiresAt: current.expiresAt,
          familyId: current.familyId,
          membershipId: current.membershipId,
          refreshTokenHash: nextToken.hash,
          tenantId: current.tenantId,
          userId: current.userId,
        },
      });
      const memberships = await transaction.tenantMembership.findMany({
        where: { userId: current.userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
        include: { tenant: true },
        orderBy: { tenant: { name: "asc" } },
      });
      return {
        kind: "success" as const,
        membership: current.membership,
        memberships,
        previousSessionId: current.id,
        sessionId: session.id,
        user: current.user,
        expiresAt: current.expiresAt,
      };
    });

    if (outcome.kind === "invalid") throw new UnauthorizedException("Session is invalid.");
    await this.sessionInvalidations?.publish({ id: outcome.previousSessionId, scope: "SESSION" });
    return this.createEnvelope(
      outcome.user,
      outcome.membership,
      outcome.memberships,
      outcome.sessionId,
      nextToken.token,
      outcome.expiresAt,
    );
  }

  public async authenticateAccessToken(token: string): Promise<AuthenticatedIdentity> {
    const claims = this.accessTokens.verify(token);
    if (!claims) throw new UnauthorizedException("Access token is invalid.");
    const session = await this.prisma.userSession.findUnique({
      where: { id: claims.sessionId },
      include: { user: true, membership: { include: { tenant: true } } },
    });
    const valid =
      session &&
      session.revokedAt === null &&
      session.lastUsedAt === null &&
      session.expiresAt > new Date() &&
      session.userId === claims.sub &&
      session.tenantId === claims.tenantId &&
      session.membershipId === claims.membershipId &&
      session.user.status === "ACTIVE" &&
      session.membership.status === "ACTIVE" &&
      session.membership.tenant.status === "ACTIVE";
    if (!valid) throw new UnauthorizedException("Session is invalid.");
    return toIdentity(session.user, session.membership, session.id);
  }

  public async logout(rawRefreshToken: string | null): Promise<void> {
    if (!rawRefreshToken) return;
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: this.refreshTokens.hash(rawRefreshToken) },
      select: { familyId: true },
    });
    if (!session) return;
    const family = await this.prisma.userSession.findMany({
      select: { id: true },
      where: { familyId: session.familyId, revokedAt: null },
    });
    await this.prisma.userSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "logout" },
    });
    const invalidations = this.sessionInvalidations;
    if (invalidations) {
      await Promise.all(family.map(({ id }) => invalidations.publish({ id, scope: "SESSION" })));
    }
  }

  public async revokeAll(identity: AuthenticatedIdentity): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId: identity.userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "revoke-all" },
    });
    await this.sessionInvalidations?.publish({ id: identity.userId, scope: "USER" });
  }

  public async switchTenant(
    identity: AuthenticatedIdentity,
    tenantId: string,
  ): Promise<AuthenticationEnvelope> {
    const nextToken = this.refreshTokens.create();
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.userSession.findUnique({
        where: { id: identity.sessionId },
      });
      const target = await transaction.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: identity.userId } },
        include: { tenant: true },
      });
      if (
        !current ||
        current.revokedAt !== null ||
        current.lastUsedAt !== null ||
        current.expiresAt <= now ||
        !target ||
        target.status !== "ACTIVE" ||
        target.tenant.status !== "ACTIVE"
      ) {
        return { kind: "invalid" as const };
      }

      const consumed = await transaction.userSession.updateMany({
        where: { id: current.id, lastUsedAt: null, revokedAt: null },
        data: { lastUsedAt: now, revokedAt: now, revokeReason: "tenant-switch" },
      });
      if (consumed.count !== 1) return { kind: "invalid" as const };
      const session = await transaction.userSession.create({
        data: {
          expiresAt: current.expiresAt,
          familyId: current.familyId,
          membershipId: target.id,
          refreshTokenHash: nextToken.hash,
          tenantId: target.tenantId,
          userId: target.userId,
        },
      });
      const user = await transaction.user.findUniqueOrThrow({ where: { id: identity.userId } });
      const memberships = await transaction.tenantMembership.findMany({
        where: { userId: identity.userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
        include: { tenant: true },
        orderBy: { tenant: { name: "asc" } },
      });
      return {
        kind: "success" as const,
        expiresAt: current.expiresAt,
        membership: target,
        memberships,
        sessionId: session.id,
        user,
      };
    });

    if (outcome.kind === "invalid") throw new UnauthorizedException("Tenant switch is invalid.");
    await this.sessionInvalidations?.publish({ id: identity.sessionId, scope: "SESSION" });
    return this.createEnvelope(
      outcome.user,
      outcome.membership,
      outcome.memberships,
      outcome.sessionId,
      nextToken.token,
      outcome.expiresAt,
    );
  }

  public async listTenants(identity: AuthenticatedIdentity): Promise<readonly TenantOption[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: identity.userId, status: "ACTIVE", tenant: { status: "ACTIVE" } },
      include: { tenant: true },
      orderBy: { tenant: { name: "asc" } },
    });
    return memberships.map((membership) => toTenantOption(membership as MembershipView));
  }

  public async listActiveQueueIds(
    tenantId: string,
    membershipId: string,
  ): Promise<readonly string[]> {
    const memberships = await this.prisma.queueMember.findMany({
      select: { queueId: true },
      where: {
        membershipId,
        queue: { status: "ACTIVE" },
        status: "ACTIVE",
        tenantId,
      },
    });
    return memberships.map((membership) => membership.queueId);
  }

  public async listMemberships(identity: AuthenticatedIdentity): Promise<readonly object[]> {
    this.assertPermission(identity, "memberships.read");
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId: identity.tenantId },
      include: { user: true },
      orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }],
    });
    return memberships.map(toMembershipResponse);
  }

  public async getMembership(
    identity: AuthenticatedIdentity,
    membershipId: string,
  ): Promise<object> {
    this.assertPermission(identity, "memberships.read");
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_id: { tenantId: identity.tenantId, id: membershipId } },
      include: { user: true },
    });
    if (!membership) throw new NotFoundException("Membership was not found.");
    return toMembershipResponse(membership);
  }

  public async changeRole(
    identity: AuthenticatedIdentity,
    membershipId: string,
    role: TenantRole,
  ): Promise<object> {
    this.assertPermission(identity, "memberships.manage-role");
    const result = await this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.tenantMembership.findUnique({
        where: { tenantId_id: { tenantId: identity.tenantId, id: membershipId } },
        include: { user: true },
      });
      if (!membership) return { kind: "missing" as const };
      if (role === "REQUESTER" && membership.customerContactId === null) {
        return { kind: "requester-contact-required" as const };
      }
      if (membership.role === "OWNER" && role !== "OWNER") {
        const owners = await transaction.tenantMembership.count({
          where: { tenantId: identity.tenantId, role: "OWNER", status: "ACTIVE" },
        });
        if (owners <= 1) return { kind: "last-owner" as const };
      }

      const updated = await transaction.tenantMembership.update({
        where: { id: membership.id },
        data: {
          role,
          ...(role === "REQUESTER" ? {} : { customerContactId: null }),
        },
        include: { user: true },
      });
      await transaction.identityAuditEntry.create({
        data: {
          action: "membership.role.changed",
          actorUserId: identity.userId,
          metadata: { from: membership.role, to: role },
          subjectId: membership.id,
          subjectType: "tenant_membership",
          tenantId: identity.tenantId,
        },
      });
      return { kind: "success" as const, membership: updated };
    });

    if (result.kind === "missing") throw new NotFoundException("Membership was not found.");
    if (result.kind === "requester-contact-required") {
      throw new BadRequestException("Requester membership requires a customer contact.");
    }
    if (result.kind === "last-owner")
      throw new ConflictException("The final owner cannot be changed.");
    await this.sessionInvalidations?.publish({ id: membershipId, scope: "MEMBERSHIP" });
    return toMembershipResponse(result.membership);
  }

  public async changeStatus(
    identity: AuthenticatedIdentity,
    membershipId: string,
    status: "ACTIVE" | "DISABLED",
  ): Promise<object> {
    this.assertPermission(identity, "memberships.manage-status");
    if (membershipId === identity.membershipId && status === "DISABLED") {
      throw new ConflictException("The active membership cannot disable itself.");
    }
    const result = await this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.tenantMembership.findUnique({
        where: { tenantId_id: { tenantId: identity.tenantId, id: membershipId } },
        include: { user: true },
      });
      if (!membership) return { kind: "missing" as const };
      if (membership.role === "OWNER" && membership.status === "ACTIVE" && status === "DISABLED") {
        const owners = await transaction.tenantMembership.count({
          where: { tenantId: identity.tenantId, role: "OWNER", status: "ACTIVE" },
        });
        if (owners <= 1) return { kind: "last-owner" as const };
      }
      const updated = await transaction.tenantMembership.update({
        where: { id: membership.id },
        data: { status },
        include: { user: true },
      });
      if (status === "DISABLED") {
        await transaction.userSession.updateMany({
          where: { membershipId: membership.id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: "membership-disabled" },
        });
      }
      await transaction.identityAuditEntry.create({
        data: {
          action: "membership.status.changed",
          actorUserId: identity.userId,
          metadata: { from: membership.status, to: status },
          subjectId: membership.id,
          subjectType: "tenant_membership",
          tenantId: identity.tenantId,
        },
      });
      return { kind: "success" as const, membership: updated };
    });
    if (result.kind === "missing") throw new NotFoundException("Membership was not found.");
    if (result.kind === "last-owner")
      throw new ConflictException("The final owner cannot be disabled.");
    await this.sessionInvalidations?.publish({ id: membershipId, scope: "MEMBERSHIP" });
    return toMembershipResponse(result.membership);
  }

  private async createSession(
    user: UserView,
    membership: MembershipView,
    memberships: readonly MembershipView[],
  ): Promise<AuthenticationEnvelope> {
    const refresh = this.refreshTokens.create();
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + this.config.values.refreshSessionTtlDays);
    const session = await this.prisma.userSession.create({
      data: {
        expiresAt,
        familyId: randomUUID(),
        membershipId: membership.id,
        refreshTokenHash: refresh.hash,
        tenantId: membership.tenantId,
        userId: user.id,
      },
    });
    return this.createEnvelope(user, membership, memberships, session.id, refresh.token, expiresAt);
  }

  private createEnvelope(
    user: UserView,
    membership: MembershipView,
    memberships: readonly MembershipView[],
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): AuthenticationEnvelope {
    const identity = toIdentity(user, membership, sessionId);
    const access = this.accessTokens.issue({
      membershipId: identity.membershipId,
      sessionId,
      tenantId: identity.tenantId,
      userId: identity.userId,
    });
    return {
      body: authenticatedResponse(identity, memberships, access.token, access.expiresAt),
      refreshExpiresAt,
      refreshToken,
    };
  }

  private assertPermission(identity: AuthenticatedIdentity, permission: Permission): void {
    if (!hasPermission(identity.role, permission)) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }
}

function toIdentity(
  user: UserView,
  membership: MembershipView,
  sessionId: string,
): AuthenticatedIdentity {
  if (!isTenantRole(membership.role)) throw new Error("Unknown tenant role.");
  return {
    customerContactId: membership.customerContactId,
    displayName: user.displayName,
    email: user.email,
    membershipId: membership.id,
    permissions: permissionsForRole(membership.role),
    role: membership.role,
    sessionId,
    tenantId: membership.tenantId,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    tenantTimeZone: membership.tenant.timeZone,
    userId: user.id,
  };
}

function toTenantOption(membership: MembershipView): TenantOption {
  if (!isTenantRole(membership.role)) throw new Error("Unknown tenant role.");
  return {
    id: membership.tenant.id,
    name: membership.tenant.name,
    role: membership.role,
    slug: membership.tenant.slug,
  };
}

function tenantSelectionResponse(memberships: readonly MembershipView[]): AuthenticationResponse {
  return {
    accessToken: null,
    accessTokenExpiresAtUtc: null,
    activeTenant: null,
    requiresTenantSelection: true,
    tenants: memberships.map(toTenantOption),
    user: null,
  };
}

function authenticatedResponse(
  identity: AuthenticatedIdentity,
  memberships: readonly MembershipView[],
  accessToken: string,
  accessTokenExpiresAt: Date,
): AuthenticationResponse {
  return {
    accessToken,
    accessTokenExpiresAtUtc: accessTokenExpiresAt.toISOString(),
    activeTenant: {
      id: identity.tenantId,
      name: identity.tenantName,
      permissions: identity.permissions,
      role: identity.role,
      slug: identity.tenantSlug,
      timeZone: identity.tenantTimeZone,
    },
    requiresTenantSelection: false,
    tenants: memberships.map(toTenantOption),
    user: { displayName: identity.displayName, email: identity.email, id: identity.userId },
  };
}

function toMembershipResponse(membership: {
  customerContactId: string | null;
  id: string;
  role: string;
  status: string;
  tenantId: string;
  user: { displayName: string; email: string; id: string };
}): object {
  return {
    customerContactId: membership.customerContactId,
    id: membership.id,
    role: membership.role,
    status: membership.status,
    tenantId: membership.tenantId,
    user: {
      displayName: membership.user.displayName,
      email: membership.user.email,
      id: membership.user.id,
    },
  };
}
