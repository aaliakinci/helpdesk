import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { IdentityService } from "../../src/server/modules/identity/application/identity.service.js";
import {
  DEMO_EMAILS,
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
  DEMO_USERS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import { AccessTokenService } from "../../src/server/modules/identity/security/access-token.js";
import { LoginRateLimiter } from "../../src/server/modules/identity/security/login-rate-limiter.js";
import { PasswordHasher } from "../../src/server/modules/identity/security/password-hasher.js";
import { RefreshTokenService } from "../../src/server/modules/identity/security/refresh-token.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";

describe("identity and tenant security", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const passwords = new PasswordHasher();
  const accessTokens = new AccessTokenService(config);
  const refreshTokens = new RefreshTokenService(config);
  const identity = new IdentityService(
    prisma,
    passwords,
    accessTokens,
    refreshTokens,
    new LoginRateLimiter(config),
    config,
  );
  const demoPassword = process.env.DEMO_SEED_PASSWORD ?? "";

  beforeAll(async () => {
    if (!demoPassword)
      throw new Error("DEMO_SEED_PASSWORD is required for identity integration tests.");
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.userSession.deleteMany({ where: { userId: { in: Object.values(DEMO_USERS) } } });
    await prisma.tenantMembership.update({
      where: { id: DEMO_MEMBERSHIPS.acmeAgent },
      data: { role: "AGENT", status: "ACTIVE" },
    });
    await prisma.beforeApplicationShutdown();
  });

  it("requires explicit selection for a valid multi-tenant identity", async () => {
    const selection = await identity.login({
      clientAddress: "integration-multi-tenant",
      email: DEMO_EMAILS.owner,
      password: demoPassword,
      tenantId: null,
    });

    expect(selection.body.requiresTenantSelection).toBe(true);
    expect(selection.body.tenants.map((tenant) => tenant.id)).toEqual([
      DEMO_TENANTS.acme,
      DEMO_TENANTS.globex,
    ]);
    expect(selection.refreshToken).toBeNull();
  });

  it("derives tenant context on the server and hides cross-tenant memberships", async () => {
    const owner = await login(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "integration-isolation");
    const ownerContext = await identity.authenticateAccessToken(owner.body.accessToken ?? "");

    expect(ownerContext.tenantId).toBe(DEMO_TENANTS.acme);
    await expect(
      identity.getMembership(ownerContext, DEMO_MEMBERSHIPS.globexAgent),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      identity.changeRole(ownerContext, DEMO_MEMBERSHIPS.globexAgent, "AUDITOR"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      prisma.tenantMembership.findUniqueOrThrow({ where: { id: DEMO_MEMBERSHIPS.globexAgent } }),
    ).resolves.toMatchObject({ role: "AGENT", tenantId: DEMO_TENANTS.globex });
  });

  it("enforces requester and session ownership invariants in PostgreSQL", async () => {
    const invalidMembershipId = randomUUID();
    await expect(
      prisma.tenantMembership.create({
        data: {
          id: invalidMembershipId,
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.globexAgent,
          role: "REQUESTER",
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.tenantMembership.count({ where: { id: invalidMembershipId } }),
    ).resolves.toBe(0);

    const invalidSessionId = randomUUID();
    await expect(
      prisma.userSession.create({
        data: {
          expiresAt: new Date(Date.now() + 60_000),
          familyId: randomUUID(),
          id: invalidSessionId,
          membershipId: DEMO_MEMBERSHIPS.acmeAgent,
          refreshTokenHash: "f".repeat(64),
          tenantId: DEMO_TENANTS.acme,
          userId: DEMO_USERS.globexAgent,
        },
      }),
    ).rejects.toThrow();
    await expect(prisma.userSession.count({ where: { id: invalidSessionId } })).resolves.toBe(0);
  });

  it("rotates refresh tokens and revokes the family when an old token is reused", async () => {
    const loginEnvelope = await login(DEMO_EMAILS.agent, DEMO_TENANTS.acme, "integration-rotation");
    const firstRefresh = loginEnvelope.refreshToken ?? "";
    const rotated = await identity.refresh(firstRefresh);

    expect(rotated.refreshToken).not.toBe(firstRefresh);
    await expect(identity.refresh(firstRefresh)).rejects.toMatchObject({ status: 401 });
    await expect(
      identity.authenticateAccessToken(rotated.body.accessToken ?? ""),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("applies role changes to existing access tokens and records an audit entry", async () => {
    const owner = await login(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "integration-owner-role");
    const agent = await login(DEMO_EMAILS.agent, DEMO_TENANTS.acme, "integration-agent-role");
    const ownerContext = await identity.authenticateAccessToken(owner.body.accessToken ?? "");

    await identity.changeRole(ownerContext, DEMO_MEMBERSHIPS.acmeAgent, "AUDITOR");
    const changedContext = await identity.authenticateAccessToken(agent.body.accessToken ?? "");
    expect(changedContext.role).toBe("AUDITOR");
    expect(changedContext.permissions).not.toContain("tickets.manage");
    await expect(
      prisma.identityAuditEntry.count({
        where: {
          action: "membership.role.changed",
          subjectId: DEMO_MEMBERSHIPS.acmeAgent,
          tenantId: DEMO_TENANTS.acme,
        },
      }),
    ).resolves.toBeGreaterThan(0);
    await identity.changeRole(ownerContext, DEMO_MEMBERSHIPS.acmeAgent, "AGENT");
  });

  it("binds Requester access to a same-tenant customer contact", async () => {
    const requester = await login(
      DEMO_EMAILS.requester,
      DEMO_TENANTS.acme,
      "integration-requester",
    );
    const context = await identity.authenticateAccessToken(requester.body.accessToken ?? "");

    expect(context.role).toBe("REQUESTER");
    expect(context.customerContactId).toMatch(/^[0-9a-f-]{36}$/);
    expect(context.permissions).toContain("tickets.read-own");
    expect(context.permissions).not.toContain("tickets.read");
  });

  it("enforces Auditor read-only behavior inside the application use case", async () => {
    const auditor = await login(DEMO_EMAILS.auditor, DEMO_TENANTS.acme, "integration-auditor");
    const context = await identity.authenticateAccessToken(auditor.body.accessToken ?? "");

    await expect(
      identity.changeRole(context, DEMO_MEMBERSHIPS.acmeAgent, "AUDITOR"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(identity.listMemberships(context)).resolves.toHaveLength(6);
  });

  it("rejects disabled users and invalidates a disabled membership immediately", async () => {
    await expect(
      login(DEMO_EMAILS.disabled, DEMO_TENANTS.acme, "integration-disabled-user"),
    ).rejects.toMatchObject({ status: 401 });

    const owner = await login(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "integration-owner-status");
    const agent = await login(DEMO_EMAILS.agent, DEMO_TENANTS.acme, "integration-agent-status");
    const ownerContext = await identity.authenticateAccessToken(owner.body.accessToken ?? "");
    await identity.changeStatus(ownerContext, DEMO_MEMBERSHIPS.acmeAgent, "DISABLED");
    await expect(
      identity.authenticateAccessToken(agent.body.accessToken ?? ""),
    ).rejects.toMatchObject({
      status: 401,
    });
    await identity.changeStatus(ownerContext, DEMO_MEMBERSHIPS.acmeAgent, "ACTIVE");
  });

  it("rotates the session when switching to another owned tenant", async () => {
    const owner = await login(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "integration-switch");
    const acmeContext = await identity.authenticateAccessToken(owner.body.accessToken ?? "");
    const switched = await identity.switchTenant(acmeContext, DEMO_TENANTS.globex);
    const globexContext = await identity.authenticateAccessToken(switched.body.accessToken ?? "");

    expect(globexContext.tenantId).toBe(DEMO_TENANTS.globex);
    await expect(
      identity.authenticateAccessToken(owner.body.accessToken ?? ""),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  function login(email: string, tenantId: string, clientAddress: string) {
    return identity.login({ clientAddress, email, password: demoPassword, tenantId });
  }
});
