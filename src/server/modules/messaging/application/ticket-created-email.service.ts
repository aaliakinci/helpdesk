import { Injectable } from "@nestjs/common";

import { PrismaService, writeStructuredLog } from "../../../platform/index.js";
import type { IntegrationEventEnvelope } from "../domain/integration-event-envelope.js";
import { DemoEmailProvider } from "../infrastructure/demo-email-provider.service.js";
import { IdempotentConsumerService } from "./idempotent-consumer.service.js";
import { TICKET_ASSIGNED_NOTIFICATION } from "./ticket-created-notification.service.js";

const CONSUMER_NAME = "ticket-created.demo-email.v1";

@Injectable()
export class TicketCreatedEmailService {
  public constructor(
    private readonly emailProvider: DemoEmailProvider,
    private readonly idempotency: IdempotentConsumerService,
    private readonly prisma: PrismaService,
  ) {}

  public async handle(envelope: IntegrationEventEnvelope): Promise<void> {
    let result: "processed" | "duplicate";
    try {
      result = await this.idempotency.run(CONSUMER_NAME, envelope, async (transaction) => {
        const notification = await transaction.notification.findFirst({
          include: {
            deliveries: { where: { channel: "EMAIL" } },
            recipient: { include: { user: true } },
            ticket: { select: { number: true } },
          },
          where: {
            kind: TICKET_ASSIGNED_NOTIFICATION,
            sourceMessageId: envelope.messageId,
            tenantId: envelope.tenantId,
          },
        });
        const delivery = notification?.deliveries[0];
        if (!notification) return;
        if (!delivery || !notification.ticket) throw new Error("Email delivery record is invalid.");
        if (delivery.status === "DELIVERED") return;

        await this.emailProvider.send({
          deduplicationKey: delivery.deduplicationKey,
          notificationId: notification.id,
          recipientEmail: notification.recipient.user.email,
          ticketNumber: notification.ticket.number,
        });
        await transaction.notificationDelivery.update({
          data: {
            attempts: { increment: 1 },
            deliveredAt: new Date(),
            lastErrorCode: null,
            status: "DELIVERED",
          },
          where: { id: delivery.id },
        });
      });
    } catch (error: unknown) {
      await this.prisma.notificationDelivery.updateMany({
        data: {
          attempts: { increment: 1 },
          lastErrorCode: error instanceof Error ? error.name.slice(0, 100) : "UnknownError",
        },
        where: {
          channel: "EMAIL",
          notification: { sourceMessageId: envelope.messageId, tenantId: envelope.tenantId },
          status: "PENDING",
        },
      });
      throw error;
    }
    writeStructuredLog("support-worker", "info", "notification.email.consumed", {
      duplicate: result === "duplicate",
      messageId: envelope.messageId,
      traceparent: envelope.traceparent,
    });
  }

  public async markFailed(envelope: IntegrationEventEnvelope, error: unknown): Promise<void> {
    await this.prisma.notificationDelivery.updateMany({
      data: {
        lastErrorCode: error instanceof Error ? error.name.slice(0, 100) : "UnknownError",
        status: "FAILED",
      },
      where: {
        channel: "EMAIL",
        notification: { sourceMessageId: envelope.messageId, tenantId: envelope.tenantId },
        status: "PENDING",
      },
    });
  }
}
