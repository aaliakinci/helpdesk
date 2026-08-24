import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AssignmentCommandService } from "../../src/server/modules/support/application/assignment-command.service.js";
import { OperationsQueryService } from "../../src/server/modules/support/application/operations-query.service.js";
import { QueueCommandService } from "../../src/server/modules/support/application/queue-command.service.js";
import { QueueQueryService } from "../../src/server/modules/support/application/queue-query.service.js";
import { SupportEventWriter } from "../../src/server/modules/support/application/support-event-writer.service.js";
import { SlaLifecycleService } from "../../src/server/modules/sla/application/sla-lifecycle.service.js";
import { TicketCommandService } from "../../src/server/modules/support/application/ticket-command.service.js";
import { TicketQueryService } from "../../src/server/modules/support/application/ticket-query.service.js";
import { IdentityService } from "../../src/server/modules/identity/application/identity.service.js";
import {
  DEMO_EMAILS,
  DEMO_TENANTS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import type { AuthenticatedIdentity } from "../../src/server/modules/identity/domain/identity.types.js";
import { AccessTokenService } from "../../src/server/modules/identity/security/access-token.js";
import { LoginRateLimiter } from "../../src/server/modules/identity/security/login-rate-limiter.js";
import { PasswordHasher } from "../../src/server/modules/identity/security/password-hasher.js";
import { RefreshTokenService } from "../../src/server/modules/identity/security/refresh-token.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";
import { RequestContextService } from "../../src/server/platform/observability/request-context.js";

describe("queue and assignment operations", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const requestContext = new RequestContextService();
  const events = new SupportEventWriter(requestContext);
  const identityService = new IdentityService(
    prisma,
    new PasswordHasher(),
    new AccessTokenService(config),
    new RefreshTokenService(config),
    new LoginRateLimiter(config),
    config,
  );
  const ticketQueries = new TicketQueryService(prisma);
  const ticketCommands = new TicketCommandService(
    prisma,
    events,
    ticketQueries,
    new SlaLifecycleService(),
  );
  const queueQueries = new QueueQueryService(prisma);
  const queueCommands = new QueueCommandService(prisma, events, queueQueries);
  const assignments = new AssignmentCommandService(prisma, events, ticketQueries);
  const operations = new OperationsQueryService(prisma);
  const password = process.env.DEMO_SEED_PASSWORD ?? "";
  const createdTicketIds = new Set<string>();
  const createdQueueIds = new Set<string>();
  const createdUserIds = new Set<string>();
  let initialCounter: number | null = null;
  let owner: AuthenticatedIdentity;
  let agent: AuthenticatedIdentity;
  let requester: AuthenticatedIdentity;
  let globexAgent: AuthenticatedIdentity;
  let secondAgent: AuthenticatedIdentity;
  let outsiderAgent: AuthenticatedIdentity;
  let queue: Awaited<ReturnType<QueueCommandService["createQueue"]>>;

  beforeAll(async () => {
    if (!password) throw new Error("DEMO_SEED_PASSWORD is required for queue integration tests.");
    await prisma.onModuleInit();
    [owner, agent, requester, globexAgent] = await Promise.all([
      authenticate(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "queue-owner"),
      authenticate(DEMO_EMAILS.agent, DEMO_TENANTS.acme, "queue-agent"),
      authenticate(DEMO_EMAILS.requester, DEMO_TENANTS.acme, "queue-requester"),
      authenticate(DEMO_EMAILS.globexAgent, DEMO_TENANTS.globex, "queue-globex"),
    ]);
    initialCounter =
      (
        await prisma.tenantTicketCounter.findUnique({
          where: { tenantId: DEMO_TENANTS.acme },
        })
      )?.lastNumber ?? null;
    secondAgent = await createAgentIdentity("Second Queue Agent");
    outsiderAgent = await createAgentIdentity("Outside Queue Agent");
  });

  afterAll(async () => {
    const ticketIds = [...createdTicketIds];
    const aggregateIds = [...ticketIds, ...createdQueueIds];
    if (aggregateIds.length > 0) {
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: { in: aggregateIds } } });
      await prisma.auditEntry.deleteMany({ where: { aggregateId: { in: aggregateIds } } });
    }
    if (ticketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    if (createdQueueIds.size > 0) {
      await prisma.queue.deleteMany({ where: { id: { in: [...createdQueueIds] } } });
    }
    if (createdUserIds.size > 0) {
      await prisma.tenantMembership.deleteMany({
        where: { userId: { in: [...createdUserIds] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
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
    if (owner && agent && requester && globexAgent) {
      await prisma.userSession.deleteMany({
        where: {
          userId: { in: [owner.userId, agent.userId, requester.userId, globexAgent.userId] },
        },
      });
    }
    await prisma.beforeApplicationShutdown();
  });

  it("lets managers create queues and manage only active Agent memberships", async () => {
    queue = await queueCommands.createQueue(owner, {
      description: "Integration assignment queue",
      name: `Integration Queue ${randomUUID()}`,
    });
    createdQueueIds.add(queue.id);
    await expect(
      queueCommands.createQueue(agent, { description: null, name: "Forbidden" }),
    ).rejects.toMatchObject({ status: 403 });

    queue = await queueCommands.setMember(owner, queue.id, {
      expectedVersion: queue.version,
      membershipId: agent.membershipId,
      status: "ACTIVE",
    });
    queue = await queueCommands.setMember(owner, queue.id, {
      expectedVersion: queue.version,
      membershipId: secondAgent.membershipId,
      status: "ACTIVE",
    });
    expect(queue.members.filter((member) => member.status === "ACTIVE")).toHaveLength(2);
    await expect(queueQueries.listQueues(outsiderAgent)).resolves.toEqual([]);
    await expect(queueQueries.listQueues(agent)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: queue.id })]),
    );
  });

  it("allows only one assignment for the same ticket revision", async () => {
    const ticket = await createTicket("single-winner");
    const results = await Promise.allSettled([
      assignments.assign(owner, ticket.id, {
        assigneeMembershipId: agent.membershipId,
        expectedVersion: ticket.version,
        queueId: queue.id,
      }),
      assignments.assign(owner, ticket.id, {
        assigneeMembershipId: secondAgent.membershipId,
        expectedVersion: ticket.version,
        queueId: queue.id,
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    await expect(prisma.ticketAssignment.count({ where: { ticketId: ticket.id } })).resolves.toBe(
      1,
    );
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect([agent.membershipId, secondAgent.membershipId]).toContain(
      current.currentAssigneeMembershipId,
    );
  });

  it("serializes parallel round-robin cursor updates across active members", async () => {
    const tickets = await Promise.all(
      Array.from({ length: 8 }, (_, index) => createTicket(`round-robin-${index}`)),
    );
    const assigned = await Promise.all(
      tickets.map((ticket) =>
        assignments.assignRoundRobin(owner, ticket.id, {
          expectedVersion: ticket.version,
          queueId: queue.id,
        }),
      ),
    );
    const distribution = new Map<string, number>();
    for (const ticket of assigned) {
      const membershipId = ticket.assignee?.membershipId ?? "missing";
      distribution.set(membershipId, (distribution.get(membershipId) ?? 0) + 1);
    }
    expect(distribution).toEqual(
      new Map([
        [agent.membershipId, 4],
        [secondAgent.membershipId, 4],
      ]),
    );
    await expect(
      prisma.queueAssignmentState.findUniqueOrThrow({
        where: { tenantId_queueId: { queueId: queue.id, tenantId: owner.tenantId } },
      }),
    ).resolves.toMatchObject({ version: 8 });
  });

  it("prevents queue outsiders from reading or taking over a queued ticket", async () => {
    const created = await createTicket("queue-access");
    const queued = await assignments.setQueue(owner, created.id, {
      expectedVersion: created.version,
      queueId: queue.id,
    });
    await expect(ticketQueries.getTicket(outsiderAgent, queued.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      assignments.takeOver(outsiderAgent, queued.id, queued.version),
    ).rejects.toMatchObject({ status: 404 });
    await expect(ticketQueries.getTicket(agent, queued.id)).resolves.toMatchObject({
      id: queued.id,
    });
    await expect(prisma.ticketAssignment.count({ where: { ticketId: queued.id } })).resolves.toBe(
      1,
    );
  });

  it("returns only assignment state to requesters without operational assignment data", async () => {
    const created = await createTicket("requester-assignment-projection");
    const assigned = await assignments.assign(owner, created.id, {
      assigneeMembershipId: agent.membershipId,
      expectedVersion: created.version,
      queueId: queue.id,
    });

    const requesterDetail = await ticketQueries.getTicket(requester, assigned.id);
    expect(requesterDetail.assignmentStatus).toBe("ASSIGNED");
    expect(requesterDetail).not.toHaveProperty("assignedAtUtc");
    expect(requesterDetail).not.toHaveProperty("assignee");
    expect(requesterDetail).not.toHaveProperty("queue");
    expect(requesterDetail).not.toHaveProperty("assignmentHistory");
    expect(requesterDetail).not.toHaveProperty("statusHistory");
    expect(requesterDetail).not.toHaveProperty("sla");

    const requesterPage = await ticketQueries.listTickets(requester, {
      assignment: "UNASSIGNED",
      page: 1,
      pageSize: 20,
      priority: null,
      queueId: randomUUID(),
      search: assigned.subject,
      sortBy: "updatedAt",
      sortDirection: "desc",
      status: null,
    });
    expect(requesterPage.items).toHaveLength(1);
    expect(requesterPage.items[0]).toMatchObject({
      assignmentStatus: "ASSIGNED",
      id: assigned.id,
    });
    expect(requesterPage.items[0]).not.toHaveProperty("assignee");
    expect(requesterPage.items[0]).not.toHaveProperty("queue");

    const staffDetail = await ticketQueries.getTicket(owner, assigned.id);
    expect(staffDetail).toMatchObject({
      assignmentStatus: "ASSIGNED",
      assignee: { membershipId: agent.membershipId },
      queue: { id: queue.id },
    });
  });

  it("writes assignment history, ticket revision, audit, and outbox in one graph", async () => {
    const created = await createTicket("assignment-graph");
    const queued = await assignments.setQueue(owner, created.id, {
      expectedVersion: created.version,
      queueId: queue.id,
    });
    const assigned = await assignments.assign(owner, created.id, {
      assigneeMembershipId: secondAgent.membershipId,
      expectedVersion: queued.version,
      queueId: queue.id,
    });
    const unassigned = await assignments.unassign(owner, created.id, assigned.version);
    const taken = await assignments.takeOver(agent, created.id, unassigned.version);

    expect(taken.version).toBe(created.version + 4);
    expect(taken.assignmentHistory.map((entry) => entry.action)).toEqual([
      "QUEUED",
      "ASSIGNED",
      "UNASSIGNED",
      "TAKEN_OVER",
    ]);
    await expect(
      prisma.auditEntry.count({
        where: { action: "ticket.assignment.changed", aggregateId: created.id },
      }),
    ).resolves.toBe(4);
    await expect(
      prisma.outboxMessage.count({
        where: { aggregateId: created.id, eventType: "ticket.assignment-changed.v1" },
      }),
    ).resolves.toBe(4);
  });

  it("keeps cross-tenant queues and memberships side-effect free", async () => {
    const ticket = await createTicket("cross-tenant-assignment");
    const globexQueue = await prisma.queue.create({
      data: {
        name: `Globex Queue ${randomUUID()}`,
        tenantId: DEMO_TENANTS.globex,
        assignmentState: { create: {} },
      },
    });
    createdQueueIds.add(globexQueue.id);
    const before = await prisma.ticketAssignment.count({ where: { ticketId: ticket.id } });

    await expect(
      assignments.setQueue(owner, ticket.id, {
        expectedVersion: ticket.version,
        queueId: globexQueue.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      queueCommands.setMember(owner, queue.id, {
        expectedVersion: queue.version,
        membershipId: globexAgent.membershipId,
        status: "ACTIVE",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      prisma.queueMember.create({
        data: {
          membershipId: globexAgent.membershipId,
          queueId: queue.id,
          tenantId: owner.tenantId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.ticketAssignment.count({ where: { ticketId: ticket.id } })).resolves.toBe(
      before,
    );
  });

  it("returns tenant-scoped dashboard and agent workload projections", async () => {
    const dashboard = await operations.dashboard(owner);
    expect(dashboard.queues.some((item) => item.id === queue.id)).toBe(true);
    expect(["ACTIVE", "NOT_CONFIGURED"]).toContain(dashboard.sla.status);
    const managerWorkload = await operations.agentWorkload(owner, queue.id);
    expect(managerWorkload.map((item) => item.membershipId).sort()).toEqual(
      [agent.membershipId, secondAgent.membershipId].sort(),
    );
    await expect(operations.agentWorkload(agent, queue.id)).resolves.toEqual([
      expect.objectContaining({ membershipId: agent.membershipId }),
    ]);
    await expect(operations.dashboard(requester)).rejects.toMatchObject({ status: 403 });
  });

  async function authenticate(email: string, tenantId: string, clientAddress: string) {
    const login = await identityService.login({ clientAddress, email, password, tenantId });
    return identityService.authenticateAccessToken(login.body.accessToken ?? "");
  }

  async function createAgentIdentity(displayName: string): Promise<AuthenticatedIdentity> {
    const user = await prisma.user.create({
      data: {
        displayName,
        email: `${randomUUID()}@integration.helpdesk.test`,
        passwordHash: `integration-${randomUUID()}`,
        memberships: {
          create: { role: "AGENT", tenantId: DEMO_TENANTS.acme },
        },
      },
      include: { memberships: true },
    });
    createdUserIds.add(user.id);
    const membership = user.memberships[0];
    if (!membership) throw new Error("Integration Agent membership was not created.");
    return {
      ...agent,
      displayName: user.displayName,
      email: user.email,
      membershipId: membership.id,
      permissions: agent.permissions,
      userId: user.id,
    };
  }

  async function createTicket(label: string) {
    const ticket = await ticketCommands.createTicket(owner, {
      description: "Queue assignment integration ticket",
      priority: "NORMAL",
      requesterContactId: requester.customerContactId,
      subject: `${label}-${randomUUID()}`,
    });
    createdTicketIds.add(ticket.id);
    return ticket;
  }
});
