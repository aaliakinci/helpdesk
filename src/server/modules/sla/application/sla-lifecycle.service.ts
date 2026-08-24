import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../platform/database/generated/client.js";
import type { SlaPriority } from "../domain/sla-policy.js";
import { addMinutes, calculateSlaSnapshot } from "../domain/sla-policy.js";

@Injectable()
export class SlaLifecycleService {
  public async createForTicket(
    transaction: Prisma.TransactionClient,
    input: {
      readonly createdAt: Date;
      readonly priority: SlaPriority;
      readonly tenantId: string;
      readonly ticketId: string;
    },
  ): Promise<void> {
    const policy = await transaction.slaPolicy.findUnique({
      include: { targets: { where: { priority: input.priority } } },
      where: { tenantId: input.tenantId },
    });
    const target = policy?.targets[0];
    if (!policy || !target) return;
    const snapshot = calculateSlaSnapshot(input.createdAt, target);
    await transaction.ticketSlaState.create({
      data: {
        approachingBeforeMinutesSnapshot: target.approachingBeforeMinutes,
        autoCloseResolvedMinutesSnapshot: policy.autoCloseResolvedMinutes,
        firstResponseApproachingAt: snapshot.firstResponseApproachingAt,
        firstResponseDueAt: snapshot.firstResponseDueAt,
        firstResponseMinutesSnapshot: target.firstResponseMinutes,
        policyId: policy.id,
        policyVersion: policy.version,
        prioritySnapshot: input.priority,
        resolutionApproachingAt: snapshot.resolutionApproachingAt,
        resolutionDueAt: snapshot.resolutionDueAt,
        resolutionMinutesSnapshot: target.resolutionMinutes,
        tenantId: input.tenantId,
        ticketId: input.ticketId,
      },
    });
  }

  public async completeFirstResponse(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string,
    completedAt: Date,
  ): Promise<void> {
    await transaction.ticketSlaState.updateMany({
      data: {
        firstResponseCompletedAt: completedAt,
        firstResponseStatus: "COMPLETED",
        version: { increment: 1 },
      },
      where: { firstResponseCompletedAt: null, tenantId, ticketId },
    });
  }

  public async completeResolution(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string,
    completedAt: Date,
  ): Promise<void> {
    const state = await transaction.ticketSlaState.findUnique({
      where: { tenantId_ticketId: { tenantId, ticketId } },
    });
    if (!state) return;
    await transaction.ticketSlaState.update({
      data: {
        autoCloseAt: addMinutes(completedAt, state.autoCloseResolvedMinutesSnapshot),
        ...(state.resolutionCompletedAt
          ? {}
          : { resolutionCompletedAt: completedAt, resolutionStatus: "COMPLETED" as const }),
        version: { increment: 1 },
      },
      where: { tenantId_ticketId: { tenantId, ticketId } },
    });
  }

  public async cancelAutoClose(
    transaction: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string,
  ): Promise<void> {
    await transaction.ticketSlaState.updateMany({
      data: { autoCloseAt: null, version: { increment: 1 } },
      where: { autoCloseAt: { not: null }, tenantId, ticketId },
    });
  }
}
