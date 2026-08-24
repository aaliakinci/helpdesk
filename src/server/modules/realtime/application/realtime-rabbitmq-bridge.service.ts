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
import { decodeIntegrationEventEnvelope } from "../../messaging/domain/integration-event-envelope.js";
import {
  readDeliveryAttempt,
  resolveDeliveryFailure,
} from "../../messaging/domain/retry-policy.js";
import {
  assertMessagingTopology,
  RABBIT_TOPOLOGY,
} from "../../messaging/infrastructure/rabbitmq-topology.js";
import { projectRealtimeEvent } from "../domain/realtime-invalidation.js";
import { RealtimeGateway } from "../presentation/realtime.gateway.js";
import { RealtimeAudienceService } from "./realtime-audience.service.js";

@Injectable()
export class RealtimeRabbitMqBridgeService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private channel: ConfirmChannel | undefined;
  private consumerTag: string | undefined;
  private readonly inFlight = new Set<Promise<void>>();
  private reconnectTimer: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly audience: RealtimeAudienceService,
    private readonly config: PlatformConfigService,
    private readonly gateway: RealtimeGateway,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  public onApplicationBootstrap(): void {
    void this.start();
  }

  public async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => undefined);
    }
    await Promise.allSettled([...this.inFlight]);
    await this.channel?.close().catch(() => undefined);
    this.channel = undefined;
  }

  private async start(): Promise<void> {
    if (this.stopping || this.channel) return;
    try {
      const channel = await this.rabbitMq.createConfirmChannel();
      await assertMessagingTopology(channel);
      await channel.prefetch(this.config.values.rabbitMqPrefetch);
      this.channel = channel;
      channel.on("error", () => undefined);
      channel.on("close", () => {
        this.channel = undefined;
        this.consumerTag = undefined;
        this.scheduleReconnect();
      });
      const consumer = await channel.consume(
        RABBIT_TOPOLOGY.realtimeQueue,
        (message) => {
          if (!message) return;
          const task = this.handle(message).finally(() => this.inFlight.delete(task));
          this.inFlight.add(task);
          void task;
        },
        { noAck: false },
      );
      this.consumerTag = consumer.consumerTag;
      writeStructuredLog("support-api", "info", "realtime.rabbitmq_bridge.ready");
    } catch (error: unknown) {
      await this.channel?.close().catch(() => undefined);
      this.channel = undefined;
      this.consumerTag = undefined;
      writeStructuredLog("support-api", "warn", "realtime.rabbitmq_bridge.deferred", {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopping || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.start();
    }, 5_000);
    this.reconnectTimer.unref();
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) return;
    try {
      const decoded: unknown = JSON.parse(message.content.toString("utf8"));
      const envelope = decodeIntegrationEventEnvelope(decoded);
      const projection = projectRealtimeEvent(envelope);
      if (projection) {
        const resolved = await this.audience.resolve(envelope.tenantId, projection);
        if (resolved) this.gateway.publish(resolved.rooms, resolved.invalidation);
      }
      channel.ack(message);
    } catch (error: unknown) {
      await this.transferFailure(channel, message, error);
    }
  }

  private async transferFailure(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    error: unknown,
  ): Promise<void> {
    const attempt = readDeliveryAttempt(
      message.properties.headers?.["x-helpdesk-realtime-attempt"],
    );
    const route = resolveDeliveryFailure(attempt, this.config.values.messagingMaxAttempts);
    const headers = {
      ...(message.properties.headers ?? {}),
      "x-helpdesk-realtime-attempt": route.nextAttempt,
      "x-helpdesk-realtime-error": (error instanceof Error ? error.name : "UnknownError").slice(
        0,
        100,
      ),
    };
    try {
      channel.publish(
        route.terminal ? RABBIT_TOPOLOGY.deadLetterExchange : RABBIT_TOPOLOGY.realtimeRetryExchange,
        route.terminal ? "realtime.dead" : `realtime.retry.${route.delayMilliseconds}`,
        message.content,
        {
          contentType: "application/json",
          headers,
          persistent: true,
          ...(typeof message.properties.messageId === "string"
            ? { messageId: message.properties.messageId }
            : {}),
        },
      );
      await channel.waitForConfirms();
      channel.ack(message);
      writeStructuredLog(
        "support-api",
        route.terminal ? "error" : "warn",
        route.terminal ? "realtime.event.dead_lettered" : "realtime.event.retry_scheduled",
        { attempt: route.nextAttempt, terminal: route.terminal },
      );
    } catch (transferError: unknown) {
      if (!this.stopping) channel.nack(message, false, true);
      writeStructuredLog("support-api", "error", "realtime.event.transfer_failed", {
        reason: transferError instanceof Error ? transferError.name : "UnknownError",
      });
    }
  }
}
