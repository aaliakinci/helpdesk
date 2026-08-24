import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotificationService } from "../../src/server/modules/notifications/application/notification.service.js";
import {
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
  DEMO_USERS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import type { AuthenticatedIdentity } from "../../src/server/modules/identity/index.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";

describe("notification membership isolation", () => {
  const prisma = new PrismaService(new PlatformConfigService());
  const notifications = new NotificationService(prisma);
  const createdIds: string[] = [];
  const acmeAgent = identity(DEMO_TENANTS.acme, DEMO_MEMBERSHIPS.acmeAgent, DEMO_USERS.agent);
  const globexAgent = identity(
    DEMO_TENANTS.globex,
    DEMO_MEMBERSHIPS.globexAgent,
    DEMO_USERS.globexAgent,
  );

  beforeAll(async () => {
    await prisma.onModuleInit();
    for (const target of [acmeAgent, globexAgent]) {
      const created = await prisma.notification.create({
        data: {
          kind: "TICKET_AUTO_ASSIGNED",
          payload: { subject: "Private assignment", ticketNumber: 42 },
          recipientMembershipId: target.membershipId,
          sourceMessageId: randomUUID(),
          tenantId: target.tenantId,
        },
      });
      createdIds.push(created.id);
    }
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.beforeApplicationShutdown();
  });

  it("lists only the active tenant membership's notifications", async () => {
    const page = await notifications.list(acmeAgent);

    expect(page.items.some((item) => item.id === createdIds[0])).toBe(true);
    expect(page.items.some((item) => item.id === createdIds[1])).toBe(false);
  });

  it("does not let one membership mark another membership's notification read", async () => {
    await expect(notifications.markRead(acmeAgent, createdIds[1] ?? "")).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      prisma.notification.findUniqueOrThrow({ where: { id: createdIds[1] } }),
    ).resolves.toMatchObject({ readAt: null });
  });
});

function identity(tenantId: string, membershipId: string, userId: string): AuthenticatedIdentity {
  return {
    customerContactId: null,
    displayName: "Integration Agent",
    email: "agent@integration.test",
    membershipId,
    permissions: [],
    role: "AGENT",
    sessionId: randomUUID(),
    tenantId,
    tenantName: "Integration Tenant",
    tenantSlug: "integration-tenant",
    tenantTimeZone: "UTC",
    userId,
  };
}
