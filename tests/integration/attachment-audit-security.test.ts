import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttachmentService } from "../../src/server/modules/attachments/application/attachment.service.js";
import { LocalAttachmentStorage } from "../../src/server/modules/attachments/infrastructure/local-attachment-storage.js";
import type { AttachmentStorage } from "../../src/server/modules/attachments/domain/attachment-storage.js";
import { AuditQueryService } from "../../src/server/modules/audit/application/audit-query.service.js";
import {
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
  DEMO_USERS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import type { AuthenticatedIdentity } from "../../src/server/modules/identity/domain/identity.types.js";
import {
  permissionsForRole,
  type TenantRole,
} from "../../src/server/modules/identity/domain/permissions.js";
import { SlaLifecycleService } from "../../src/server/modules/sla/application/sla-lifecycle.service.js";
import { SupportEventWriter } from "../../src/server/modules/support/application/support-event-writer.service.js";
import { TicketCommandService } from "../../src/server/modules/support/application/ticket-command.service.js";
import { TicketQueryService } from "../../src/server/modules/support/application/ticket-query.service.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";
import { RequestContextService } from "../../src/server/platform/observability/request-context.js";

describe("attachment and audit security", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const requestContext = new RequestContextService();
  const events = new SupportEventWriter(requestContext);
  const ticketQueries = new TicketQueryService(prisma);
  const ticketCommands = new TicketCommandService(
    prisma,
    events,
    ticketQueries,
    new SlaLifecycleService(),
  );
  const audit = new AuditQueryService(prisma);
  const createdTicketIds = new Set<string>();
  const createdAuditIds = new Set<string>();
  let storageDirectory = "";
  let attachments: AttachmentService;
  let agent: AuthenticatedIdentity;
  let requester: AuthenticatedIdentity;
  let auditor: AuthenticatedIdentity;
  let globexAgent: AuthenticatedIdentity;

  beforeAll(async () => {
    await prisma.onModuleInit();
    storageDirectory = await mkdtemp(join(tmpdir(), "helpdesk-attachments-"));
    attachments = new AttachmentService(
      prisma,
      config,
      events,
      new LocalAttachmentStorage(storageDirectory),
    );
    const requesterMembership = await prisma.tenantMembership.findUniqueOrThrow({
      select: { customerContactId: true },
      where: { id: DEMO_MEMBERSHIPS.acmeRequester },
    });
    agent = identity("AGENT", DEMO_TENANTS.acme, DEMO_USERS.agent, DEMO_MEMBERSHIPS.acmeAgent);
    requester = identity(
      "REQUESTER",
      DEMO_TENANTS.acme,
      DEMO_USERS.requester,
      DEMO_MEMBERSHIPS.acmeRequester,
      requesterMembership.customerContactId,
    );
    auditor = identity(
      "AUDITOR",
      DEMO_TENANTS.acme,
      DEMO_USERS.auditor,
      DEMO_MEMBERSHIPS.acmeAuditor,
    );
    globexAgent = identity(
      "AGENT",
      DEMO_TENANTS.globex,
      DEMO_USERS.globexAgent,
      DEMO_MEMBERSHIPS.globexAgent,
    );
  });

  afterAll(async () => {
    if (createdAuditIds.size > 0) {
      await prisma.auditEntry.deleteMany({ where: { id: { in: [...createdAuditIds] } } });
    }
    if (createdTicketIds.size > 0) {
      const ids = [...createdTicketIds];
      await prisma.outboxMessage.deleteMany({ where: { aggregateId: { in: ids } } });
      await prisma.auditEntry.deleteMany({ where: { aggregateId: { in: ids } } });
      await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.beforeApplicationShutdown();
    if (storageDirectory) await rm(storageDirectory, { force: true, recursive: true });
  });

  it("stores private checksummed attachments and enforces tenant and visibility scopes", async () => {
    const ticket = await createRequesterTicket();
    const publicAttachment = await attachments.upload(agent, ticket.id, {
      commentId: null,
      file: uploadedFile("evidence.txt", "text/plain", Buffer.from("safe evidence", "utf8")),
      visibility: "PUBLIC",
    });
    const internalAttachment = await attachments.upload(agent, ticket.id, {
      commentId: null,
      file: uploadedFile("diagnostic.txt", "text/plain", Buffer.from("staff diagnostic", "utf8")),
      visibility: "INTERNAL",
    });

    const stored = await prisma.attachment.findUniqueOrThrow({
      where: { id: publicAttachment.id },
    });
    expect(stored.checksumSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored.storageKey).toMatch(new RegExp(`^${DEMO_TENANTS.acme}/[0-9a-f-]{36}$`, "u"));
    expect(publicAttachment).not.toHaveProperty("storageKey");
    expect(publicAttachment).not.toHaveProperty("checksumSha256");

    await expect(attachments.download(requester, publicAttachment.id)).resolves.toMatchObject({
      attachment: { id: publicAttachment.id, visibility: "PUBLIC" },
    });
    await expect(attachments.download(requester, internalAttachment.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(attachments.download(globexAgent, publicAttachment.id)).rejects.toMatchObject({
      status: 404,
    });
    const requesterView = await ticketQueries.getTicket(requester, ticket.id);
    expect(requesterView.attachments.map((item) => item.id)).toEqual([publicAttachment.id]);

    await writeFile(join(storageDirectory, stored.storageKey), "tampered bytes", "utf8");
    await expect(attachments.download(requester, publicAttachment.id)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("rejects MIME spoofing, unsupported files, oversized payloads, and auditor mutation", async () => {
    const ticket = await createRequesterTicket();
    await expect(
      attachments.upload(agent, ticket.id, {
        commentId: null,
        file: uploadedFile("spoof.png", "image/png", Buffer.from("plain text", "utf8")),
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      attachments.upload(agent, ticket.id, {
        commentId: null,
        file: uploadedFile(
          "archive.zip",
          "application/zip",
          Buffer.from("504b0304140000000000", "hex"),
        ),
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      attachments.upload(agent, ticket.id, {
        commentId: null,
        file: uploadedFile(
          "too-large.txt",
          "text/plain",
          Buffer.alloc(config.values.attachmentMaxBytes + 1, 65),
        ),
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      attachments.upload(auditor, ticket.id, {
        commentId: null,
        file: uploadedFile("audit.txt", "text/plain", Buffer.from("read only", "utf8")),
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const fileCountBeforeRollback = await storedFileCount(storageDirectory);
    await expect(
      requestContext.run("attachment-rollback", "x".repeat(129), () =>
        attachments.upload(agent, ticket.id, {
          commentId: null,
          file: uploadedFile("rollback.txt", "text/plain", Buffer.from("rollback", "utf8")),
          visibility: "PUBLIC",
        }),
      ),
    ).rejects.toBeDefined();
    await expect(storedFileCount(storageDirectory)).resolves.toBe(fileCountBeforeRollback);
    await expect(prisma.attachment.count({ where: { ticketId: ticket.id } })).resolves.toBe(0);
  });

  it("maps storage write failures to a retryable response without creating metadata", async () => {
    const ticket = await createRequesterTicket();
    const unavailableStorage: AttachmentStorage = {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(Buffer.from("unavailable")),
      put: () =>
        Promise.reject(Object.assign(new Error("sensitive storage path"), { code: "EACCES" })),
    };
    const unavailableAttachments = new AttachmentService(
      prisma,
      config,
      events,
      unavailableStorage,
    );

    await expect(
      unavailableAttachments.upload(agent, ticket.id, {
        commentId: null,
        file: uploadedFile("unavailable.txt", "text/plain", Buffer.from("retry later", "utf8")),
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ message: "Attachment storage is unavailable.", status: 503 });
    await expect(prisma.attachment.count({ where: { ticketId: ticket.id } })).resolves.toBe(0);
    await expect(
      prisma.auditEntry.count({
        where: { action: "ticket.attachment.added", aggregateId: ticket.id },
      }),
    ).resolves.toBe(0);
  });

  it("returns only tenant-scoped audit data and strips secret-bearing metadata", async () => {
    const action = `security.review.${randomUUID()}`;
    const attachmentId = randomUUID();
    const own = await prisma.auditEntry.create({
      data: {
        action,
        actorType: "USER",
        actorUserId: agent.userId,
        aggregateId: randomUUID(),
        aggregateType: "security-test",
        metadata: {
          attachmentId,
          body: "must-not-leave-the-server",
          secret: "must-not-leave-the-server",
          token: "must-not-leave-the-server",
          version: 2,
        },
        tenantId: agent.tenantId,
      },
    });
    const foreign = await prisma.auditEntry.create({
      data: {
        action,
        actorType: "SYSTEM",
        aggregateId: randomUUID(),
        aggregateType: "security-test",
        metadata: { version: 99 },
        tenantId: globexAgent.tenantId,
      },
    });
    createdAuditIds.add(own.id);
    createdAuditIds.add(foreign.id);

    const result = await audit.list(auditor, {
      action,
      actorType: null,
      actorUserId: null,
      aggregateType: "security-test",
      from: null,
      page: 1,
      pageSize: 10,
      to: null,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(own.id);
    expect(result.items[0]?.metadata).toEqual({ attachmentId, version: 2 });
    expect(JSON.stringify(result)).not.toMatch(/must-not-leave|secret|token|body/u);
  });

  async function createRequesterTicket() {
    const ticket = await ticketCommands.createTicket(agent, {
      description: "Attachment isolation integration ticket",
      priority: "NORMAL",
      requesterContactId: requester.customerContactId,
      subject: `attachment-${randomUUID()}`,
    });
    createdTicketIds.add(ticket.id);
    return ticket;
  }
});

function identity(
  role: TenantRole,
  tenantId: string,
  userId: string,
  membershipId: string,
  customerContactId: string | null = null,
): AuthenticatedIdentity {
  return {
    customerContactId,
    displayName: `${role} integration identity`,
    email: `${role.toLowerCase()}-${userId}@example.test`,
    membershipId,
    permissions: permissionsForRole(role),
    role,
    sessionId: randomUUID(),
    tenantId,
    tenantName: tenantId === DEMO_TENANTS.acme ? "Acme Support" : "Globex Service",
    tenantSlug: tenantId === DEMO_TENANTS.acme ? "acme" : "globex",
    tenantTimeZone: "Europe/Istanbul",
    userId,
  };
}

function uploadedFile(originalname: string, mimetype: string, buffer: Buffer) {
  return { buffer, mimetype, originalname, size: buffer.byteLength };
}

async function storedFileCount(directory: string): Promise<number> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).length;
}
