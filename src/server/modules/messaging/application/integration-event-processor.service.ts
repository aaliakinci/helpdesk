import { Injectable } from "@nestjs/common";

import { RequestContextService, writeStructuredLog } from "../../../platform/index.js";
import {
  decodeTicketCreatedPayload,
  type IntegrationEventEnvelope,
} from "../domain/integration-event-envelope.js";
import { TicketCreatedAssignmentService } from "./ticket-created-assignment.service.js";
import { TicketCreatedEmailService } from "./ticket-created-email.service.js";
import { TicketCreatedNotificationService } from "./ticket-created-notification.service.js";

@Injectable()
export class IntegrationEventProcessorService {
  public constructor(
    private readonly assignment: TicketCreatedAssignmentService,
    private readonly email: TicketCreatedEmailService,
    private readonly notifications: TicketCreatedNotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async process(envelope: IntegrationEventEnvelope): Promise<void> {
    await this.requestContext.run(
      envelope.messageId,
      envelope.correlationId ?? envelope.messageId,
      async () => {
        if (envelope.type !== "ticket.created.v1" || envelope.schemaVersion !== 1) {
          writeStructuredLog("support-worker", "info", "integration_event.ignored", {
            messageId: envelope.messageId,
            type: envelope.type,
          });
          return;
        }
        const payload = decodeTicketCreatedPayload(envelope.payload);
        await this.assignment.handle(envelope, payload);
        await this.notifications.handle(envelope, payload);
        await this.email.handle(envelope);
      },
      envelope.traceparent,
    );
  }

  public async markTerminalFailure(
    envelope: IntegrationEventEnvelope,
    error: unknown,
  ): Promise<void> {
    if (envelope.type === "ticket.created.v1" && envelope.schemaVersion === 1) {
      await this.email.markFailed(envelope, error);
    }
  }
}
