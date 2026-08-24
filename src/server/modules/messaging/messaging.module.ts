import { Module } from "@nestjs/common";

import { PlatformModule } from "../../platform/index.js";
import { SupportEventWriter } from "../support/application/support-event-writer.service.js";
import { IdempotentConsumerService } from "./application/idempotent-consumer.service.js";
import { IntegrationEventProcessorService } from "./application/integration-event-processor.service.js";
import { OutboxPublisherService } from "./application/outbox-publisher.service.js";
import { RabbitMqConsumerService } from "./application/rabbitmq-consumer.service.js";
import { TicketCreatedAssignmentService } from "./application/ticket-created-assignment.service.js";
import { TicketCreatedEmailService } from "./application/ticket-created-email.service.js";
import { TicketCreatedNotificationService } from "./application/ticket-created-notification.service.js";
import { DemoEmailProvider } from "./infrastructure/demo-email-provider.service.js";

const providers = [
  DemoEmailProvider,
  IdempotentConsumerService,
  IntegrationEventProcessorService,
  OutboxPublisherService,
  RabbitMqConsumerService,
  SupportEventWriter,
  TicketCreatedAssignmentService,
  TicketCreatedEmailService,
  TicketCreatedNotificationService,
] as const;

@Module({
  exports: [IntegrationEventProcessorService, OutboxPublisherService],
  imports: [PlatformModule],
  providers: [...providers],
})
export class MessagingModule {}
