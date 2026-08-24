import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { RequestContextService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";

interface SupportEventActor {
  readonly tenantId: string;
  readonly userId: string;
}

@Injectable()
export class SupportEventWriter {
  public constructor(private readonly requestContext: RequestContextService) {}

  public async write(
    transaction: Prisma.TransactionClient,
    identity: SupportEventActor,
    input: {
      readonly action: string;
      readonly aggregateId: string;
      readonly aggregateType: "queue" | "ticket";
      readonly eventType: string;
      readonly metadata: Readonly<Record<string, Prisma.InputJsonValue>> | null;
      readonly payload: Readonly<Record<string, Prisma.InputJsonValue>>;
    },
  ): Promise<void> {
    const messageId = randomUUID();
    const occurredAtUtc = new Date().toISOString();
    await transaction.auditEntry.create({
      data: {
        action: input.action,
        actorUserId: identity.userId,
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        tenantId: identity.tenantId,
      },
    });
    await transaction.outboxMessage.create({
      data: {
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        ...(this.requestContext.traceId ? { causationId: this.requestContext.traceId } : {}),
        ...(this.requestContext.correlationId
          ? { correlationId: this.requestContext.correlationId }
          : {}),
        ...(this.requestContext.traceparent
          ? { traceparent: this.requestContext.traceparent }
          : {}),
        eventType: input.eventType,
        id: messageId,
        payload: {
          ...input.payload,
          messageId,
          occurredAtUtc,
          schemaVersion: 1,
          tenantId: identity.tenantId,
        },
        schemaVersion: 1,
        tenantId: identity.tenantId,
      },
    });
  }
}
