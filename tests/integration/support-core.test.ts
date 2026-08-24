import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { CustomerService } from "../../src/server/modules/support/application/customer.service.js";
import { TicketCommandService } from "../../src/server/modules/support/application/ticket-command.service.js";
import { TicketQueryService } from "../../src/server/modules/support/application/ticket-query.service.js";
import { SupportEventWriter } from "../../src/server/modules/support/application/support-event-writer.service.js";
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

describe("customer and ticket transaction core", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const requestContext = new RequestContextService();
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
    new SupportEventWriter(requestContext),
    ticketQueries,
  );
  const customers = new CustomerService(prisma);
  const password = process.env.DEMO_SEED_PASSWORD ?? "";
  const createdTicketIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  let initialCounters: Readonly<Record<string, number | null>> | null = null;
  let agent: AuthenticatedIdentity;
  let owner: AuthenticatedIdentity;
  let requester: AuthenticatedIdentity;
  let globexAgent: AuthenticatedIdentity;

  beforeAll(async () => {
    if (!password) throw new Error("DEMO_SEED_PASSWORD is required for support integration tests.");
    await prisma.onModuleInit();
    [agent, owner, requester, globexAgent] = await Promise.all([
      authenticate(DEMO_EMAILS.agent, DEMO_TENANTS.acme, "support-agent"),
      authenticate(DEMO_EMAILS.owner, DEMO_TENANTS.acme, "support-owner"),
      authenticate(DEMO_EMAILS.requester, DEMO_TENANTS.acme, "support-requester"),
      authenticate(DEMO_EMAILS.globexAgent, DEMO_TENANTS.globex, "support-globex"),
    ]);
    const counters = await prisma.tenantTicketCounter.findMany({
      where: { tenantId: { in: [DEMO_TENANTS.acme, DEMO_TENANTS.globex] } },
    });
    initialCounters = Object.fromEntries(
      [DEMO_TENANTS.acme, DEMO_TENANTS.globex].map((tenantId) => [
        tenantId,
        counters.find((counter) => counter.tenantId === tenantId)?.lastNumber ?? null,
      ]),
    );
  });

  afterAll(async () => {
    const ticketIds = [...createdTicketIds];
    if (ticketIds.length > 0) {
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: { in: ticketIds } } });
      await prisma.auditEntry.deleteMany({ where: { aggregateId: { in: ticketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    }
    if (createdCustomerIds.size > 0) {
      await prisma.customer.deleteMany({ where: { id: { in: [...createdCustomerIds] } } });
    }
    if (initialCounters) {
      for (const [tenantId, lastNumber] of Object.entries(initialCounters)) {
        if (lastNumber === null) {
          await prisma.tenantTicketCounter.deleteMany({ where: { tenantId } });
        } else {
          await prisma.tenantTicketCounter.upsert({
            create: { lastNumber, tenantId },
            update: { lastNumber },
            where: { tenantId },
          });
        }
      }
    }
    if (agent && owner && requester && globexAgent) {
      await prisma.userSession.deleteMany({
        where: {
          userId: {
            in: [agent.userId, owner.userId, requester.userId, globexAgent.userId],
          },
        },
      });
    }
    await prisma.beforeApplicationShutdown();
  });

  it("creates and updates customer contacts with aggregate history and stale-write protection", async () => {
    const customer = await customers.createCustomer(owner, {
      name: `Integration Customer ${randomUUID()}`,
    });
    createdCustomerIds.add(customer.id);
    const renamed = await customers.updateCustomer(owner, customer.id, {
      expectedVersion: customer.version,
      name: `${customer.name} Updated`,
    });
    const withContact = await customers.createContact(owner, customer.id, {
      displayName: "Integration Contact",
      email: `contact-${randomUUID()}@example.test`,
      expectedVersion: renamed.version,
    });

    expect(withContact.version).toBe(3);
    expect(withContact.contacts).toHaveLength(1);
    await expect(
      customers.updateCustomer(owner, customer.id, { expectedVersion: 1, name: "Stale" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(customers.listHistory(owner, customer.id)).resolves.toHaveLength(3);
  });

  it("commits ticket, initial history, audit, and versioned outbox in one graph", async () => {
    const ticket = await createRequesterTicket(`graph-${randomUUID()}`);
    expect(ticket.status).toBe("NEW");
    expect(ticket.version).toBe(1);
    await expect(
      prisma.ticketStatusHistory.count({
        where: { ticketId: ticket.id, tenantId: agent.tenantId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEntry.count({ where: { aggregateId: ticket.id, action: "ticket.created" } }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxMessage.findFirstOrThrow({ where: { aggregateId: ticket.id } }),
    ).resolves.toMatchObject({
      eventType: "ticket.created.v1",
      schemaVersion: 1,
      status: "PENDING",
    });
  });

  it("allocates unique tenant ticket numbers under parallel creation", async () => {
    const tickets = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createRequesterTicket(`parallel-${index}-${randomUUID()}`),
      ),
    );
    const numbers = tickets.map((ticket) => ticket.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("rolls back the entire write graph when a late outbox write fails", async () => {
    const before = await graphCounts();
    const counterBefore = await prisma.tenantTicketCounter.findUnique({
      where: { tenantId: agent.tenantId },
    });
    const subject = `rollback-${randomUUID()}`;

    await expect(
      requestContext.run("support-rollback", "x".repeat(129), () =>
        ticketCommands.createTicket(agent, {
          description: "This write must roll back after the aggregate and audit are staged.",
          priority: "NORMAL",
          requesterContactId: requester.customerContactId,
          subject,
        }),
      ),
    ).rejects.toBeDefined();

    expect(await graphCounts()).toEqual(before);
    await expect(prisma.ticket.count({ where: { subject } })).resolves.toBe(0);
    await expect(
      prisma.tenantTicketCounter.findUnique({ where: { tenantId: agent.tenantId } }),
    ).resolves.toMatchObject({ lastNumber: counterBefore?.lastNumber });
  });

  it("keeps requester ownership and internal-note projection boundaries", async () => {
    const own = await createRequesterTicket(`requester-own-${randomUUID()}`, requester);
    const internal = await ticketCommands.addComment(agent, own.id, {
      body: "Staff-only diagnostic note",
      expectedVersion: own.version,
      visibility: "INTERNAL",
    });
    await ticketCommands.addComment(agent, own.id, {
      body: "Public resolution update",
      expectedVersion: internal.version,
      visibility: "PUBLIC",
    });
    const requesterView = await ticketQueries.getTicket(requester, own.id);
    expect(requesterView.comments.map((comment) => comment.body)).toEqual([
      "Public resolution update",
    ]);
    expect(requesterView.comments.every((comment) => comment.visibility === "PUBLIC")).toBe(true);

    const foreignCustomer = await customers.createCustomer(owner, {
      name: `Other ${randomUUID()}`,
    });
    createdCustomerIds.add(foreignCustomer.id);
    const withContact = await customers.createContact(owner, foreignCustomer.id, {
      displayName: "Other Contact",
      email: `other-${randomUUID()}@example.test`,
      expectedVersion: foreignCustomer.version,
    });
    const other = await ticketCommands.createTicket(agent, {
      description: "A ticket owned by another requester contact.",
      priority: "LOW",
      requesterContactId: withContact.contacts[0]?.id ?? null,
      subject: `other-ticket-${randomUUID()}`,
    });
    createdTicketIds.add(other.id);
    await expect(ticketQueries.getTicket(requester, other.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("keeps closed terminal and reopens it as a new linked ticket", async () => {
    const created = await createRequesterTicket(`lifecycle-${randomUUID()}`);
    const resolved = await ticketCommands.changeStatus(agent, created.id, {
      expectedVersion: created.version,
      status: "RESOLVED",
    });
    const closed = await ticketCommands.changeStatus(agent, created.id, {
      expectedVersion: resolved.version,
      status: "CLOSED",
    });
    await expect(
      ticketCommands.changeStatus(agent, created.id, {
        expectedVersion: closed.version,
        status: "OPEN",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const reopened = await ticketCommands.reopenTicket(agent, created.id, closed.version);
    createdTicketIds.add(reopened.id);
    expect(reopened.id).not.toBe(created.id);
    expect(reopened.reopenedFrom).toEqual({ id: created.id, number: created.number });
    expect(reopened.number).not.toBe(created.number);
  });

  it("allows only one mutation for the same optimistic revision", async () => {
    const created = await createRequesterTicket(`revision-${randomUUID()}`);
    const results = await Promise.allSettled([
      ticketCommands.addComment(agent, created.id, {
        body: "Concurrent A",
        expectedVersion: created.version,
        visibility: "PUBLIC",
      }),
      ticketCommands.addComment(agent, created.id, {
        body: "Concurrent B",
        expectedVersion: created.version,
        visibility: "PUBLIC",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 409 } });
    const current = await ticketQueries.getTicket(agent, created.id);
    expect(current.version).toBe(created.version + 1);
    expect(current.comments).toHaveLength(1);
  });

  it("hides cross-tenant tickets and leaves rejected writes without side effects", async () => {
    const customer = await prisma.customer.create({
      data: { name: `Globex Customer ${randomUUID()}`, tenantId: DEMO_TENANTS.globex },
    });
    createdCustomerIds.add(customer.id);
    const contact = await prisma.customerContact.create({
      data: {
        customerId: customer.id,
        displayName: "Globex Contact",
        email: `globex-${randomUUID()}@example.test`,
        tenantId: DEMO_TENANTS.globex,
      },
    });
    const ticket = await ticketCommands.createTicket(globexAgent, {
      description: "Globex-only issue",
      priority: "HIGH",
      requesterContactId: contact.id,
      subject: `globex-${randomUUID()}`,
    });
    createdTicketIds.add(ticket.id);
    const before = await prisma.ticketComment.count({ where: { ticketId: ticket.id } });

    await expect(ticketQueries.getTicket(agent, ticket.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      ticketCommands.addComment(agent, ticket.id, {
        body: "Cross tenant mutation",
        expectedVersion: ticket.version,
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(prisma.ticketComment.count({ where: { ticketId: ticket.id } })).resolves.toBe(
      before,
    );
  });

  it("searches server-side within the caller's tenant and requester scope", async () => {
    const marker = `search-${randomUUID()}`;
    const own = await createRequesterTicket(`Printer ${marker}`);
    const globexCustomer = await prisma.customer.create({
      data: { name: `Globex ${marker}`, tenantId: DEMO_TENANTS.globex },
    });
    createdCustomerIds.add(globexCustomer.id);
    const globexContact = await prisma.customerContact.create({
      data: {
        customerId: globexCustomer.id,
        displayName: marker,
        email: `${marker}@example.test`,
        tenantId: DEMO_TENANTS.globex,
      },
    });
    const foreign = await ticketCommands.createTicket(globexAgent, {
      description: marker,
      priority: "NORMAL",
      requesterContactId: globexContact.id,
      subject: `Foreign ${marker}`,
    });
    createdTicketIds.add(foreign.id);

    const input = {
      assignment: "ALL" as const,
      page: 1,
      pageSize: 20,
      priority: null,
      queueId: null,
      search: marker,
      sortBy: "updatedAt" as const,
      sortDirection: "desc" as const,
      status: null,
    };
    await expect(ticketQueries.listTickets(agent, input)).resolves.toMatchObject({
      items: [expect.objectContaining({ id: own.id })],
      total: 1,
    });
    const requesterResult = await ticketQueries.listTickets(requester, input);
    expect(requesterResult.items.every((ticket) => ticket.id !== foreign.id)).toBe(true);
  });

  async function authenticate(email: string, tenantId: string, clientAddress: string) {
    const login = await identityService.login({ clientAddress, email, password, tenantId });
    return identityService.authenticateAccessToken(login.body.accessToken ?? "");
  }

  async function createRequesterTicket(subject: string, actor = agent) {
    const ticket = await ticketCommands.createTicket(actor, {
      description: "Integration ticket description",
      priority: "NORMAL",
      requesterContactId: actor.role === "REQUESTER" ? null : requester.customerContactId,
      subject,
    });
    createdTicketIds.add(ticket.id);
    return ticket;
  }

  async function graphCounts() {
    const [tickets, history, audit, outbox] = await Promise.all([
      prisma.ticket.count({ where: { tenantId: agent.tenantId } }),
      prisma.ticketStatusHistory.count({ where: { tenantId: agent.tenantId } }),
      prisma.auditEntry.count({ where: { tenantId: agent.tenantId } }),
      prisma.outboxMessage.count({ where: { tenantId: agent.tenantId } }),
    ]);
    return { audit, history, outbox, tickets };
  }
});
