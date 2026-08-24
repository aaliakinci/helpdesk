import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { RequestContextService } from "../../../platform/index.js";
import type { Prisma } from "../../../platform/database/generated/client.js";

interface SupportEventActor {
  readonly tenantId: string;
  readonly userId: string;
}

interface SupportEventInput {
  readonly action: string;
  readonly aggregateId: string;
  readonly aggregateType: "queue" | "sla_policy" | "ticket";
  readonly eventType: string;
  readonly metadata: Readonly<Record<string, Prisma.InputJsonValue>> | null;
  readonly payload: Readonly<Record<string, Prisma.InputJsonValue>>;
}

@Injectable()
export class SupportEventWriter {
  public constructor(private readonly requestContext: RequestContextService) {}

  public async write(
    transaction: Prisma.TransactionClient,
    identity: SupportEventActor,
    input: SupportEventInput,
  ): Promise<string> {
    return this.writeEvent(transaction, identity.tenantId, identity.userId, input);
  }

  public async writeSystem(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    input: SupportEventInput,
  ): Promise<string> {
    return this.writeEvent(transaction, tenantId, null, input);
  }

  private async writeEvent(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string | null,
    input: SupportEventInput,
  ): Promise<string> {
    const messageId = randomUUID();
    const occurredAtUtc = new Date().toISOString();
    await transaction.auditEntry.create({
      data: {
        action: input.action,
        actorType: actorUserId ? "USER" : "SYSTEM",
        ...(actorUserId ? { actorUserId } : {}),
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        tenantId,
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
          tenantId,
        },
        schemaVersion: 1,
        tenantId,
      },
    });
    return messageId;
  }
}
