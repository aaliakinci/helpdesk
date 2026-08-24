import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IdempotentConsumerService } from "../../src/server/modules/messaging/application/idempotent-consumer.service.js";
import { IntegrationEventProcessorService } from "../../src/server/modules/messaging/application/integration-event-processor.service.js";
import { TicketCreatedAssignmentService } from "../../src/server/modules/messaging/application/ticket-created-assignment.service.js";
import { TicketCreatedEmailService } from "../../src/server/modules/messaging/application/ticket-created-email.service.js";
import { TicketCreatedNotificationService } from "../../src/server/modules/messaging/application/ticket-created-notification.service.js";
import type { IntegrationEventEnvelope } from "../../src/server/modules/messaging/domain/integration-event-envelope.js";
import { DemoEmailProvider } from "../../src/server/modules/messaging/infrastructure/demo-email-provider.service.js";
import { assertMessagingTopology } from "../../src/server/modules/messaging/infrastructure/rabbitmq-topology.js";
import { TicketCommandService } from "../../src/server/modules/support/application/ticket-command.service.js";
import { TicketQueryService } from "../../src/server/modules/support/application/ticket-query.service.js";
import { SupportEventWriter } from "../../src/server/modules/support/application/support-event-writer.service.js";
import {
  DEMO_MEMBERSHIPS,
  DEMO_TENANTS,
  DEMO_USERS,
} from "../../src/server/modules/identity/demo/demo-identities.js";
import type { AuthenticatedIdentity } from "../../src/server/modules/identity/domain/identity.types.js";
import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";
import { RabbitMqConnectionService } from "../../src/server/platform/connections/rabbitmq-connection.service.js";
import { RequestContextService } from "../../src/server/platform/observability/request-context.js";

describe("transactional messaging flow", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const rabbitMq = new RabbitMqConnectionService(config);
  const requestContext = new RequestContextService();
  const events = new SupportEventWriter(requestContext);
  const idempotency = new IdempotentConsumerService(prisma);
  const processor = new IntegrationEventProcessorService(
    new TicketCreatedAssignmentService(idempotency, events),
    new TicketCreatedEmailService(new DemoEmailProvider(), idempotency, prisma),
    new TicketCreatedNotificationService(idempotency),
    requestContext,
  );
  const tickets = new TicketCommandService(prisma, events, new TicketQueryService(prisma));
  const createdTicketIds = new Set<string>();
  const sourceMessageIds = new Set<string>();
  let initialCounter: number | null = null;

  const owner: AuthenticatedIdentity = {
    customerContactId: null,
    displayName: "Demo Owner",
    email: "owner@demo.helpdesk.test",
    membershipId: DEMO_MEMBERSHIPS.acmeOwner,
    permissions: [],
    role: "OWNER",
    sessionId: randomUUID(),
    tenantId: DEMO_TENANTS.acme,
    tenantName: "Acme Support",
    tenantSlug: "acme-support",
    tenantTimeZone: "Europe/Istanbul",
    userId: DEMO_USERS.owner,
  };

  beforeAll(async () => {
    await prisma.onModuleInit();
    await rabbitMq.onModuleInit();
    initialCounter =
      (
        await prisma.tenantTicketCounter.findUnique({
          where: { tenantId: DEMO_TENANTS.acme },
        })
      )?.lastNumber ?? null;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { ticketId: { in: [...createdTicketIds] } } });
    await prisma.consumedMessage.deleteMany({
      where: { messageId: { in: [...sourceMessageIds] } },
    });
    await prisma.outboxMessage.deleteMany({
      where: { aggregateId: { in: [...createdTicketIds] } },
    });
    await prisma.auditEntry.deleteMany({ where: { aggregateId: { in: [...createdTicketIds] } } });
    await prisma.ticket.deleteMany({ where: { id: { in: [...createdTicketIds] } } });
    if (initialCounter === null) {
      await prisma.tenantTicketCounter.deleteMany({ where: { tenantId: DEMO_TENANTS.acme } });
    } else {
      await prisma.tenantTicketCounter.update({
        data: { lastNumber: initialCounter },
        where: { tenantId: DEMO_TENANTS.acme },
      });
    }
    await rabbitMq.beforeApplicationShutdown();
    await prisma.beforeApplicationShutdown();
  });

  it("keeps publish-before-mark crash duplicates to one assignment and notification", async () => {
    const requester = await prisma.customerContact.findFirstOrThrow({
      where: { tenantId: DEMO_TENANTS.acme, userId: DEMO_USERS.requester },
    });
    const ticket = await requestContext.run(
      "messaging-integration",
      "messaging-integration",
      () =>
        tickets.createTicket(owner, {
          description: "Durable messaging integration ticket.",
          priority: "NORMAL",
          requesterContactId: requester.id,
          subject: `messaging-${randomUUID()}`,
        }),
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
    createdTicketIds.add(ticket.id);
    const outbox = await prisma.outboxMessage.findFirstOrThrow({
      where: { aggregateId: ticket.id, eventType: "ticket.created.v1" },
    });
    sourceMessageIds.add(outbox.id);
    const envelope: IntegrationEventEnvelope = {
      aggregateId: outbox.aggregateId,
      causationId: outbox.causationId,
      correlationId: outbox.correlationId,
      messageId: outbox.id,
      occurredAtUtc: outbox.occurredAt.toISOString(),
      payload: outbox.payload as Readonly<Record<string, unknown>>,
      schemaVersion: outbox.schemaVersion,
      tenantId: outbox.tenantId,
      traceparent: outbox.traceparent ?? "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      type: outbox.eventType,
    };

    await processor.process(envelope);
    await processor.process(envelope);

    await expect(prisma.ticketAssignment.count({ where: { ticketId: ticket.id } })).resolves.toBe(
      1,
    );
    await expect(
      prisma.notification.count({ where: { sourceMessageId: outbox.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.notificationDelivery.count({
        where: { notification: { sourceMessageId: outbox.id }, status: "DELIVERED" },
      }),
    ).resolves.toBe(2);
    await expect(prisma.consumedMessage.count({ where: { messageId: outbox.id } })).resolves.toBe(
      3,
    );
  });

  it("rolls back the consumed marker when the side effect fails", async () => {
    const messageId = randomUUID();
    sourceMessageIds.add(messageId);
    const envelope: IntegrationEventEnvelope = {
      aggregateId: randomUUID(),
      causationId: null,
      correlationId: null,
      messageId,
      occurredAtUtc: new Date().toISOString(),
      payload: {},
      schemaVersion: 1,
      tenantId: DEMO_TENANTS.acme,
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      type: "ticket.created.v1",
    };
    await expect(
      idempotency.run("rollback-probe.v1", envelope, async () => {
        await Promise.resolve();
        throw new Error("simulated-side-effect-failure");
      }),
    ).rejects.toThrow("simulated-side-effect-failure");
    await expect(
      prisma.consumedMessage.count({ where: { consumerName: "rollback-probe.v1", messageId } }),
    ).resolves.toBe(0);
  });

  it("declares the durable production topology and verifies RabbitMQ retry/DLX mechanics", async () => {
    const channel = await rabbitMq.createConfirmChannel();
    await assertMessagingTopology(channel);
    const suffix = randomUUID();
    const eventExchange = `helpdesk.test.events.${suffix}`;
    const retryExchange = `helpdesk.test.retry.${suffix}`;
    const deadExchange = `helpdesk.test.dlx.${suffix}`;
    const mainQueue = `helpdesk.test.main.${suffix}`;
    const retryQueue = `helpdesk.test.retry.${suffix}`;
    const deadQueue = `helpdesk.test.dead.${suffix}`;
    try {
      await channel.assertExchange(eventExchange, "direct", { autoDelete: true });
      await channel.assertExchange(retryExchange, "direct", { autoDelete: true });
      await channel.assertExchange(deadExchange, "direct", { autoDelete: true });
      await channel.assertQueue(mainQueue, { autoDelete: true });
      await channel.bindQueue(mainQueue, eventExchange, "return");
      await channel.assertQueue(retryQueue, {
        arguments: {
          "x-dead-letter-exchange": eventExchange,
          "x-dead-letter-routing-key": "return",
          "x-message-ttl": 150,
        },
        autoDelete: true,
      });
      await channel.bindQueue(retryQueue, retryExchange, "retry");
      await channel.assertQueue(deadQueue, { autoDelete: true });
      await channel.bindQueue(deadQueue, deadExchange, "dead");

      channel.publish(retryExchange, "retry", Buffer.from("transient"), { persistent: true });
      await channel.waitForConfirms();
      const retried = await waitForMessage(channel, mainQueue);
      expect(retried.content.toString()).toBe("transient");
      channel.ack(retried);

      channel.publish(deadExchange, "dead", Buffer.from("poison"), { persistent: true });
      await channel.waitForConfirms();
      const dead = await waitForMessage(channel, deadQueue);
      expect(dead.content.toString()).toBe("poison");
      channel.ack(dead);
    } finally {
      await Promise.allSettled([
        channel.deleteQueue(deadQueue),
        channel.deleteQueue(mainQueue),
        channel.deleteQueue(retryQueue),
      ]);
      await Promise.allSettled([
        channel.deleteExchange(deadExchange),
        channel.deleteExchange(eventExchange),
        channel.deleteExchange(retryExchange),
      ]);
      await channel.close();
    }
  });
});

async function waitForMessage(
  channel: Awaited<ReturnType<RabbitMqConnectionService["createConfirmChannel"]>>,
  queue: string,
) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const message = await channel.get(queue, { noAck: false });
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${queue}.`);
}
