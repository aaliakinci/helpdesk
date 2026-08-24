import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type { ConfirmChannel, ConsumeMessage } from "amqplib";

import {
  PlatformConfigService,
  RabbitMqConnectionService,
  writeStructuredLog,
} from "../../../platform/index.js";
import {
  decodeIntegrationEventEnvelope,
  type IntegrationEventEnvelope,
} from "../domain/integration-event-envelope.js";
import { readDeliveryAttempt, resolveDeliveryFailure } from "../domain/retry-policy.js";
import { assertMessagingTopology, RABBIT_TOPOLOGY } from "../infrastructure/rabbitmq-topology.js";
import { IntegrationEventProcessorService } from "./integration-event-processor.service.js";

@Injectable()
export class RabbitMqConsumerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private channel: ConfirmChannel | undefined;
  private consumerTag: string | undefined;
  private readonly inFlight = new Set<Promise<void>>();
  private stopping = false;

  public constructor(
    private readonly config: PlatformConfigService,
    private readonly processor: IntegrationEventProcessorService,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const channel = await this.rabbitMq.createConfirmChannel();
    this.channel = channel;
    await assertMessagingTopology(channel);
    await channel.prefetch(this.config.values.rabbitMqPrefetch);
    const consumer = await channel.consume(
      RABBIT_TOPOLOGY.mainQueue,
      (message) => {
        if (!message) return;
        const task = this.handleDelivery(message).finally(() => this.inFlight.delete(task));
        this.inFlight.add(task);
        void task;
      },
      { noAck: false },
    );
    this.consumerTag = consumer.consumerTag;
  }

  public async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    const channel = this.channel;
    if (channel && this.consumerTag) {
      await channel.cancel(this.consumerTag).catch(() => undefined);
    }
    await Promise.allSettled([...this.inFlight]);
    await channel?.close().catch(() => undefined);
    this.channel = undefined;
  }

  private async handleDelivery(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) return;
    let envelope: IntegrationEventEnvelope | undefined;
    try {
      const decoded: unknown = JSON.parse(message.content.toString("utf8"));
      envelope = decodeIntegrationEventEnvelope(decoded);
      await this.processor.process(envelope);
      channel.ack(message);
      writeStructuredLog("support-worker", "info", "integration_event.acked", {
        messageId: envelope.messageId,
        traceparent: envelope.traceparent,
      });
    } catch (error: unknown) {
      await this.transferFailedDelivery(channel, message, error, envelope);
    }
  }

  private async transferFailedDelivery(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    error: unknown,
    envelope: IntegrationEventEnvelope | undefined,
  ): Promise<void> {
    const attempt = readDeliveryAttempt(message.properties.headers?.["x-helpdesk-attempt"]);
    const route = resolveDeliveryFailure(attempt, this.config.values.messagingMaxAttempts);
    const reason = error instanceof Error ? error.name : "UnknownError";
    try {
      const headers = {
        ...(message.properties.headers ?? {}),
        "x-helpdesk-attempt": route.nextAttempt,
        "x-helpdesk-error": reason.slice(0, 100),
      };
      if (route.terminal) {
        if (envelope) await this.processor.markTerminalFailure(envelope, error);
        channel.publish(
          RABBIT_TOPOLOGY.deadLetterExchange,
          "dead",
          message.content,
          publishProperties(message, headers),
        );
      } else {
        channel.publish(
          RABBIT_TOPOLOGY.retryExchange,
          `retry.${route.delayMilliseconds}`,
          message.content,
          publishProperties(message, headers),
        );
      }
      await channel.waitForConfirms();
      channel.ack(message);
      writeStructuredLog(
        "support-worker",
        route.terminal ? "error" : "warn",
        route.terminal ? "integration_event.dead_lettered" : "integration_event.retry_scheduled",
        {
          attempt: route.nextAttempt,
          messageId: safeScalar(message.properties.messageId),
          terminal: route.terminal,
        },
      );
    } catch (transferError: unknown) {
      if (!this.stopping) channel.nack(message, false, true);
      writeStructuredLog("support-worker", "error", "integration_event.transfer_failed", {
        reason: transferError instanceof Error ? transferError.name : "UnknownError",
      });
    }
  }
}

function publishProperties(
  message: ConsumeMessage,
  headers: Readonly<Record<string, unknown>>,
): Parameters<ConfirmChannel["publish"]>[3] {
  return {
    appId: "support-worker",
    contentType: "application/json",
    headers,
    persistent: true,
    ...(typeof message.properties.correlationId === "string"
      ? { correlationId: message.properties.correlationId }
      : {}),
    ...(typeof message.properties.messageId === "string"
      ? { messageId: message.properties.messageId }
      : {}),
    ...(typeof message.properties.timestamp === "number"
      ? { timestamp: message.properties.timestamp }
      : {}),
    ...(typeof message.properties.type === "string" ? { type: message.properties.type } : {}),
  };
}

function safeScalar(value: unknown): string {
  return typeof value === "string" && value.length <= 128 ? value : "unknown";
}
