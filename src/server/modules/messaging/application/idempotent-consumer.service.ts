import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import { Prisma } from "../../../platform/database/generated/client.js";
import type { IntegrationEventEnvelope } from "../domain/integration-event-envelope.js";

@Injectable()
export class IdempotentConsumerService {
  public constructor(private readonly prisma: PrismaService) {}

  public async run(
    consumerName: string,
    envelope: IntegrationEventEnvelope,
    work: (transaction: Prisma.TransactionClient) => Promise<void>,
  ): Promise<"processed" | "duplicate"> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.consumedMessage.create({
          data: {
            consumerName,
            eventType: envelope.type,
            messageId: envelope.messageId,
            tenantId: envelope.tenantId,
          },
        });
        await work(transaction);
      });
      return "processed";
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return "duplicate";
      }
      throw error;
    }
  }
}
