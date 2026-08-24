import { Injectable } from "@nestjs/common";

import { writeStructuredLog } from "../../../platform/index.js";
import type {
  IntegrationEventEnvelope,
  TicketCreatedPayload,
} from "../domain/integration-event-envelope.js";
import { IdempotentConsumerService } from "./idempotent-consumer.service.js";

export const TICKET_ASSIGNED_NOTIFICATION = "TICKET_AUTO_ASSIGNED";
const CONSUMER_NAME = "ticket-created.in-app-notification.v1";

@Injectable()
export class TicketCreatedNotificationService {
  public constructor(private readonly idempotency: IdempotentConsumerService) {}

  public async handle(
    envelope: IntegrationEventEnvelope,
    payload: TicketCreatedPayload,
  ): Promise<void> {
    const result = await this.idempotency.run(CONSUMER_NAME, envelope, async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        select: {
          currentAssigneeMembershipId: true,
          id: true,
          number: true,
          subject: true,
        },
        where: { tenantId_id: { id: payload.ticketId, tenantId: envelope.tenantId } },
      });
      if (!ticket) throw new Error("TicketCreated event references a missing ticket.");
      if (!ticket.currentAssigneeMembershipId) return;

      await transaction.notification.create({
        data: {
          deliveries: {
            create: [
              {
                channel: "IN_APP",
                deduplicationKey: `${envelope.messageId}:in-app`,
                deliveredAt: new Date(),
                status: "DELIVERED",
              },
              {
                channel: "EMAIL",
                deduplicationKey: `${envelope.messageId}:email`,
                status: "PENDING",
              },
            ],
          },
          kind: TICKET_ASSIGNED_NOTIFICATION,
          payload: {
            subject: ticket.subject,
            ticketId: ticket.id,
            ticketNumber: ticket.number,
          },
          recipientMembershipId: ticket.currentAssigneeMembershipId,
          sourceMessageId: envelope.messageId,
          tenantId: envelope.tenantId,
          ticketId: ticket.id,
        },
      });
    });
    writeStructuredLog("support-worker", "info", "notification.in_app.consumed", {
      duplicate: result === "duplicate",
      messageId: envelope.messageId,
      traceparent: envelope.traceparent,
    });
  }
}
