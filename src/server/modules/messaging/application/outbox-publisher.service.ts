import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type { ConfirmChannel } from "amqplib";
import { randomUUID } from "node:crypto";

import {
  createTraceparent,
  PlatformConfigService,
  PrismaService,
  RabbitMqConnectionService,
  writeStructuredLog,
} from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";
import type { IntegrationEventEnvelope } from "../domain/integration-event-envelope.js";
import { retryDelayMilliseconds } from "../domain/retry-policy.js";
import { assertMessagingTopology, RABBIT_TOPOLOGY } from "../infrastructure/rabbitmq-topology.js";

interface LeasedOutboxMessage {
  readonly aggregate_id: string;
  readonly attempts: number;
  readonly causation_id: string | null;
  readonly correlation_id: string | null;
  readonly event_type: string;
  readonly id: string;
  readonly occurred_at: Date;
  readonly payload: Prisma.JsonValue;
  readonly schema_version: number;
  readonly tenant_id: string;
  readonly traceparent: string | null;
}

@Injectable()
export class OutboxPublisherService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly publisherId = `support-worker:${randomUUID()}`;
  private activePoll: Promise<void> | undefined;
  private channel: ConfirmChannel | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly config: PlatformConfigService,
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqConnectionService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    this.channel = await this.rabbitMq.createConfirmChannel();
    await assertMessagingTopology(this.channel);
    this.schedulePoll(0);
  }

  public async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    await this.activePoll;
    await this.channel?.close().catch(() => undefined);
    this.channel = undefined;
  }

  public async publishBatch(): Promise<number> {
    const channel = this.channel;
    if (!channel) throw new Error("Outbox publisher channel is not ready.");
    const messages = await this.leaseBatch();
    for (const message of messages) {
      await this.publishOne(channel, message);
    }
    return messages.length;
  }

  private schedulePoll(delay: number): void {
    if (this.stopping) return;
    this.pollTimer = setTimeout(() => {
      this.activePoll = this.poll().finally(() => {
        this.activePoll = undefined;
        this.schedulePoll(this.config.values.outboxPollIntervalMs);
      });
    }, delay);
    this.pollTimer.unref();
  }

  private async poll(): Promise<void> {
    try {
      await this.publishBatch();
    } catch (error: unknown) {
      writeStructuredLog("support-worker", "error", "outbox.poll.failed", {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  private async leaseBatch(): Promise<readonly LeasedOutboxMessage[]> {
    const { outboxBatchSize, outboxLeaseSeconds } = this.config.values;
    return this.prisma.$queryRaw<readonly LeasedOutboxMessage[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "outbox_messages"
        WHERE "status" = 'PENDING'::"OutboxMessageStatus"
          AND "available_at" <= CURRENT_TIMESTAMP
          AND ("locked_until" IS NULL OR "locked_until" < CURRENT_TIMESTAMP)
        ORDER BY "occurred_at" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${outboxBatchSize}
      )
      UPDATE "outbox_messages" AS message
      SET "locked_by" = ${this.publisherId},
          "locked_until" = CURRENT_TIMESTAMP + (${outboxLeaseSeconds} * INTERVAL '1 second'),
          "attempts" = message."attempts" + 1
      FROM candidates
      WHERE message."id" = candidates."id"
      RETURNING message."id", message."tenant_id", message."aggregate_id",
        message."event_type", message."schema_version", message."payload",
        message."correlation_id", message."causation_id", message."traceparent",
        message."occurred_at", message."attempts"
    `;
  }

  private async publishOne(channel: ConfirmChannel, message: LeasedOutboxMessage): Promise<void> {
    const envelope: IntegrationEventEnvelope = {
      aggregateId: message.aggregate_id,
      causationId: message.causation_id,
      correlationId: message.correlation_id,
      messageId: message.id,
      occurredAtUtc: message.occurred_at.toISOString(),
      payload: asPayload(message.payload),
      schemaVersion: message.schema_version,
      tenantId: message.tenant_id,
      traceparent: message.traceparent ?? createTraceparent(),
      type: message.event_type,
    };

    try {
      channel.publish(
        RABBIT_TOPOLOGY.eventExchange,
        envelope.type,
        Buffer.from(JSON.stringify(envelope)),
        {
          appId: "support-worker",
          contentType: "application/json",
          ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
          headers: {
            traceparent: envelope.traceparent,
            "x-helpdesk-attempt": 0,
          },
          messageId: envelope.messageId,
          persistent: true,
          timestamp: Date.parse(envelope.occurredAtUtc),
          type: envelope.type,
        },
      );
      await channel.waitForConfirms();
      const updated = await this.prisma.outboxMessage.updateMany({
        data: {
          lastErrorCode: null,
          lockedBy: null,
          lockedUntil: null,
          publishedAt: new Date(),
          status: "PUBLISHED",
        },
        where: { id: message.id, lockedBy: this.publisherId, status: "PENDING" },
      });
      if (updated.count !== 1) throw new Error("Outbox lease was lost after publication.");
      writeStructuredLog("support-worker", "info", "outbox.message.published", {
        messageId: message.id,
        traceparent: envelope.traceparent,
      });
    } catch (error: unknown) {
      await this.recordFailure(message, error);
    }
  }

  private async recordFailure(message: LeasedOutboxMessage, error: unknown): Promise<void> {
    const failed = message.attempts >= this.config.values.messagingMaxAttempts;
    await this.prisma.outboxMessage.updateMany({
      data: {
        availableAt: new Date(Date.now() + retryDelayMilliseconds(message.attempts)),
        lastErrorCode: error instanceof Error ? error.name.slice(0, 100) : "UnknownError",
        lockedBy: null,
        lockedUntil: null,
        status: failed ? "FAILED" : "PENDING",
      },
      where: { id: message.id, lockedBy: this.publisherId },
    });
    writeStructuredLog("support-worker", failed ? "error" : "warn", "outbox.message.failed", {
      attempt: message.attempts,
      messageId: message.id,
      terminal: failed,
    });
  }
}

function asPayload(value: Prisma.JsonValue): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Outbox payload must be an object.");
  }
  return value;
}
