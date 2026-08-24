export { IntegrationEventProcessorService } from "./application/integration-event-processor.service.js";
export { OutboxPublisherService } from "./application/outbox-publisher.service.js";
export {
  decodeIntegrationEventEnvelope,
  decodeTicketCreatedPayload,
} from "./domain/integration-event-envelope.js";
export { MessagingModule } from "./messaging.module.js";
export { assertMessagingTopology, RABBIT_TOPOLOGY } from "./infrastructure/rabbitmq-topology.js";
