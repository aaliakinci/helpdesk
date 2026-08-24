import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IdentityService } from "../../src/server/modules/identity/application/identity.service.js";
import {
  DEMO_EMAILS,
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import type { AuthenticatedIdentity } from "../../src/server/modules/identity/domain/identity.types.js";
import { AccessTokenService } from "../../src/server/modules/identity/security/access-token.js";
import { LoginRateLimiter } from "../../src/server/modules/identity/security/login-rate-limiter.js";
import { PasswordHasher } from "../../src/server/modules/identity/security/password-hasher.js";
import { RefreshTokenService } from "../../src/server/modules/identity/security/refresh-token.js";
import { SlaLifecycleService } from "../../src/server/modules/sla/application/sla-lifecycle.service.js";
import { SlaPolicyService } from "../../src/server/modules/sla/application/sla-policy.service.js";
import { SlaSchedulerService } from "../../src/server/modules/sla/application/sla-scheduler.service.js";
import { NotificationService } from "../../src/server/modules/notifications/application/notification.service.js";
import { OperationsQueryService } from "../../src/server/modules/support/application/operations-query.service.js";
import { SupportEventWriter } from "../../src/server/modules/support/application/support-event-writer.service.js";
import { TicketCommandService } from "../../src/server/modules/support/application/ticket-command.service.js";
import { TicketQueryService } from "../../src/server/modules/support/application/ticket-query.service.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";
import { RequestContextService } from "../../src/server/platform/observability/request-context.js";

describe("SLA lifecycle, scheduler, and operations dashboard", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const events = new SupportEventWriter(new RequestContextService());
  const lifecycle = new SlaLifecycleService();
  const queries = new TicketQueryService(prisma);
  const tickets = new TicketCommandService(prisma, events, queries, lifecycle);
  const policies = new SlaPolicyService(prisma, events);
  const scheduler = new SlaSchedulerService(prisma, config, events);
  const operations = new OperationsQueryService(prisma);
  const notifications = new NotificationService(prisma);
  const identityService = new IdentityService(
    prisma,
    new PasswordHasher(),
    new AccessTokenService(config),
    new RefreshTokenService(config),
    new LoginRateLimiter(config),
    config,
  );
  const password = process.env.DEMO_SEED_PASSWORD ?? "";
  const createdTicketIds = new Set<string>();
  const createdOutboxIds = new Set<string>();
  const createdAuditIds = new Set<string>();
  let initialCounter: number | null = null;
  let originalPolicy: Awaited<ReturnType<SlaPolicyService["get"]>>;
  let owner: AuthenticatedIdentity;
  let manager: AuthenticatedIdentity;
  let agent: AuthenticatedIdentity;
  let requester: AuthenticatedIdentity;

  beforeAll(async () => {
    if (!password) throw new Error("DEMO_SEED_PASSWORD is required for SLA integration tests.");
    await prisma.onModuleInit();
    [owner, manager, agent, requester] = await Promise.all([
      authenticate(DEMO_EMAILS.owner, "sla-owner"),
      authenticate(DEMO_EMAILS.manager, "sla-manager"),
      authenticate(DEMO_EMAILS.agent, "sla-agent"),
      authenticate(DEMO_EMAILS.requester, "sla-requester"),
    ]);
    originalPolicy = await policies.get(owner);
    initialCounter =
      (
        await prisma.tenantTicketCounter.findUnique({
          where: { tenantId: DEMO_TENANTS.acme },
        })
      )?.lastNumber ?? null;
  });

  afterAll(async () => {
    if (originalPolicy) {
      await prisma.$transaction(async (transaction) => {
        await transaction.slaPolicy.update({
          data: {
            autoCloseResolvedMinutes: originalPolicy?.autoCloseResolvedMinutes,
            version: originalPolicy?.version,
          },
          where: { id: originalPolicy?.id },
        });
        await transaction.slaPolicyTarget.deleteMany({
          where: { policyId: originalPolicy?.id, tenantId: DEMO_TENANTS.acme },
        });
        await transaction.slaPolicyTarget.createMany({
          data: (originalPolicy?.targets ?? []).map((target) => ({
            ...target,
            policyId: originalPolicy?.id ?? "",
            tenantId: DEMO_TENANTS.acme,
          })),
        });
      });
    }
    const ticketIds = [...createdTicketIds];
    await prisma.outboxMessage.deleteMany({
      where: {
        OR: [
          ...(createdOutboxIds.size > 0 ? [{ id: { in: [...createdOutboxIds] } }] : []),
          ...(ticketIds.length > 0 ? [{ aggregateId: { in: ticketIds } }] : []),
        ],
      },
    });
    await prisma.auditEntry.deleteMany({
      where: {
        OR: [
          ...(createdAuditIds.size > 0 ? [{ id: { in: [...createdAuditIds] } }] : []),
          ...(ticketIds.length > 0 ? [{ aggregateId: { in: ticketIds } }] : []),
        ],
      },
    });
    if (createdTicketIds.size > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: [...createdTicketIds] } } });
    }
    if (initialCounter === null) {
      await prisma.tenantTicketCounter.deleteMany({ where: { tenantId: DEMO_TENANTS.acme } });
    } else {
      await prisma.tenantTicketCounter.upsert({
        create: { lastNumber: initialCounter, tenantId: DEMO_TENANTS.acme },
        update: { lastNumber: initialCounter },
        where: { tenantId: DEMO_TENANTS.acme },
      });
    }
    await prisma.userSession.deleteMany({
      where: { userId: { in: [owner.userId, manager.userId, agent.userId, requester.userId] } },
    });
    await prisma.beforeApplicationShutdown();
  });

  it("snapshots the active priority policy without rewriting existing due instants", async () => {
    const shortPolicy = await savePolicy(2, 3, 1, 60);
    const ticket = await createTicket("snapshot", "URGENT");
    const before = await prisma.ticketSlaState.findUniqueOrThrow({
      where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: ticket.id } },
    });
    expect(before.policyVersion).toBe(shortPolicy.version);
    expect(before.firstResponseDueAt.getTime() - before.createdAt.getTime()).toBeLessThanOrEqual(
      3 * 60_000,
    );

    await savePolicy(120, 240, 30, 120);
    const after = await prisma.ticketSlaState.findUniqueOrThrow({
      where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: ticket.id } },
    });
    expect(after.firstResponseDueAt).toEqual(before.firstResponseDueAt);
    expect(after.resolutionDueAt).toEqual(before.resolutionDueAt);
    expect(after.policyVersion).toBe(before.policyVersion);
  });

  it("counts only the first public Agent or Manager reply as first response", async () => {
    const created = await createTicket("first-response", "NORMAL");
    const internal = await tickets.addComment(agent, created.id, {
      body: "Internal diagnostic",
      expectedVersion: created.version,
      visibility: "INTERNAL",
    });
    const requesterReply = await tickets.addComment(requester, created.id, {
      body: "Requester follow-up",
      expectedVersion: internal.version,
      visibility: "PUBLIC",
    });
    expect(
      (
        await prisma.ticketSlaState.findUniqueOrThrow({
          where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: created.id } },
        })
      ).firstResponseCompletedAt,
    ).toBeNull();
    const publicReply = await tickets.addComment(manager, created.id, {
      body: "Manager public response",
      expectedVersion: requesterReply.version,
      visibility: "PUBLIC",
    });
    expect(publicReply.firstResponseAtUtc).not.toBeNull();
    await expect(
      prisma.ticketSlaState.findUniqueOrThrow({
        where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: created.id } },
      }),
    ).resolves.toMatchObject({ firstResponseStatus: "COMPLETED" });
  });

  it("emits approaching and breached notifications once across repeated scans", async () => {
    const ticket = await createTicket("warning", "NORMAL");
    const queueMembership = await prisma.queueMember.findFirstOrThrow({
      where: {
        membershipId: DEMO_MEMBERSHIPS.acmeAgent,
        status: "ACTIVE",
        tenantId: owner.tenantId,
      },
    });
    await prisma.ticket.update({
      data: {
        currentAssigneeMembershipId: DEMO_MEMBERSHIPS.acmeAgent,
        currentQueueId: queueMembership.queueId,
      },
      where: { id: ticket.id },
    });
    const now = new Date();
    await prisma.ticketSlaState.update({
      data: {
        firstResponseApproachingAt: new Date(now.getTime() - 60_000),
        firstResponseDueAt: new Date(now.getTime() + 60_000),
        resolutionApproachingAt: new Date(now.getTime() + 3_600_000),
        resolutionDueAt: new Date(now.getTime() + 7_200_000),
      },
      where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: ticket.id } },
    });
    await expect(scheduler.runOnce()).resolves.toBeGreaterThanOrEqual(1);
    await expect(scheduler.runOnce()).resolves.toBe(0);
    expect(await notificationCount(ticket.id, "TICKET_SLA_APPROACHING")).toBe(3);
    const notificationPage = await notifications.list(owner);
    const notification = notificationPage.items.find(
      (item) => item.kind === "TICKET_SLA_APPROACHING" && item.ticketId === ticket.id,
    );
    expect(notification).toBeDefined();
    expect(notification?.milestone).toBe("FIRST_RESPONSE");
    expect(notification?.warningStage).toBe("APPROACHING");

    await prisma.ticketSlaState.update({
      data: { firstResponseDueAt: new Date(Date.now() - 1_000) },
      where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: ticket.id } },
    });
    await expect(scheduler.runOnce()).resolves.toBeGreaterThanOrEqual(1);
    await expect(scheduler.runOnce()).resolves.toBe(0);
    expect(await notificationCount(ticket.id, "TICKET_SLA_BREACHED")).toBe(3);
    await expect(
      prisma.notificationDelivery.count({ where: { notification: { ticketId: ticket.id } } }),
    ).resolves.toBe(6);
  });

  it("auto-closes a resolved ticket once with a SYSTEM history actor", async () => {
    const created = await createTicket("auto-close", "HIGH");
    const resolved = await tickets.changeStatus(agent, created.id, {
      expectedVersion: created.version,
      status: "RESOLVED",
    });
    await prisma.ticketSlaState.update({
      data: { autoCloseAt: new Date(Date.now() - 1_000) },
      where: { tenantId_ticketId: { tenantId: owner.tenantId, ticketId: created.id } },
    });
    await expect(scheduler.runOnce()).resolves.toBeGreaterThanOrEqual(1);
    await expect(scheduler.runOnce()).resolves.toBe(0);
    await expect(
      prisma.ticket.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({
      status: "CLOSED",
      version: resolved.version + 1,
    });
    await expect(
      prisma.ticketStatusHistory.findFirstOrThrow({
        orderBy: { version: "desc" },
        where: { ticketId: created.id },
      }),
    ).resolves.toMatchObject({ actorType: "SYSTEM", actorUserId: null, toStatus: "CLOSED" });
  });

  it("keeps the dashboard SQL-backed and requester-forbidden", async () => {
    const dashboard = await operations.dashboard(owner);
    expect(dashboard.sla.status).toBe("ACTIVE");
    expect(dashboard.sla.approachingTickets).toBeTypeOf("number");
    expect(dashboard.sla.breachedTickets).toBeTypeOf("number");
    await expect(operations.dashboard(requester)).rejects.toMatchObject({ status: 403 });
    const agentPolicy = await policies.get(agent);
    expect(agentPolicy.version).toBeTypeOf("number");
    await expect(policies.get(requester)).rejects.toMatchObject({ status: 403 });
  });

  async function authenticate(email: string, clientAddress: string) {
    const login = await identityService.login({
      clientAddress,
      email,
      password,
      tenantId: DEMO_TENANTS.acme,
    });
    return identityService.authenticateAccessToken(login.body.accessToken ?? "");
  }

  async function createTicket(label: string, priority: "LOW" | "NORMAL" | "HIGH" | "URGENT") {
    const before = await graphIds();
    const ticket = await tickets.createTicket(owner, {
      description: "SLA integration ticket",
      priority,
      requesterContactId: requester.customerContactId,
      subject: `${label}-${randomUUID()}`,
    });
    createdTicketIds.add(ticket.id);
    await captureNewGraphIds(before);
    return ticket;
  }

  async function savePolicy(
    firstResponseMinutes: number,
    resolutionMinutes: number,
    approachingBeforeMinutes: number,
    autoCloseResolvedMinutes: number,
  ) {
    const current = await policies.get(owner);
    const before = await graphIds();
    const saved = await policies.save(owner, {
      autoCloseResolvedMinutes,
      expectedVersion: current?.version ?? null,
      targets: (["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((priority) => ({
        approachingBeforeMinutes,
        firstResponseMinutes,
        priority,
        resolutionMinutes,
      })),
    });
    await captureNewGraphIds(before);
    return saved;
  }

  async function notificationCount(ticketId: string, kind: string) {
    return prisma.notification.count({ where: { kind, ticketId } });
  }

  async function graphIds() {
    const [outbox, audit] = await Promise.all([
      prisma.outboxMessage.findMany({ select: { id: true }, where: { tenantId: owner.tenantId } }),
      prisma.auditEntry.findMany({ select: { id: true }, where: { tenantId: owner.tenantId } }),
    ]);
    return {
      audit: new Set(audit.map((item) => item.id)),
      outbox: new Set(outbox.map((item) => item.id)),
    };
  }

  async function captureNewGraphIds(before: Awaited<ReturnType<typeof graphIds>>) {
    const after = await graphIds();
    for (const id of after.outbox) if (!before.outbox.has(id)) createdOutboxIds.add(id);
    for (const id of after.audit) if (!before.audit.has(id)) createdAuditIds.add(id);
  }
});
