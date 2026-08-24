import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";
import { SupportEventWriter } from "../../support/application/support-event-writer.service.js";
import { SLA_PRIORITIES, type SlaTargetInput } from "../domain/sla-policy.js";

export interface SlaPolicyView {
  readonly autoCloseResolvedMinutes: number;
  readonly id: string;
  readonly targets: readonly SlaTargetInput[];
  readonly updatedAtUtc: string;
  readonly version: number;
}

@Injectable()
export class SlaPolicyService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly events: SupportEventWriter,
  ) {}

  public async get(identity: AuthenticatedIdentity): Promise<SlaPolicyView | null> {
    this.assertRead(identity);
    return this.read(identity.tenantId);
  }

  public async save(
    identity: AuthenticatedIdentity,
    input: {
      readonly autoCloseResolvedMinutes: number;
      readonly expectedVersion: number | null;
      readonly targets: readonly SlaTargetInput[];
    },
  ): Promise<SlaPolicyView> {
    if (!hasPermission(identity.role, "sla.manage")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const policyId = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.slaPolicy.findUnique({
        where: { tenantId: identity.tenantId },
      });
      if (!current) {
        if (input.expectedVersion !== null) {
          throw new ConflictException("SLA policy revision is stale.");
        }
        const created = await transaction.slaPolicy.create({
          data: {
            autoCloseResolvedMinutes: input.autoCloseResolvedMinutes,
            targets: {
              create: input.targets.map((target) => ({ ...target, tenantId: identity.tenantId })),
            },
            tenantId: identity.tenantId,
          },
        });
        await this.writePolicyEvent(transaction, identity, created.id, 1);
        return created.id;
      }
      if (input.expectedVersion !== current.version) {
        throw new ConflictException("SLA policy revision is stale.");
      }
      const updated = await transaction.slaPolicy.updateMany({
        data: {
          autoCloseResolvedMinutes: input.autoCloseResolvedMinutes,
          version: { increment: 1 },
        },
        where: { id: current.id, tenantId: identity.tenantId, version: input.expectedVersion },
      });
      if (updated.count !== 1) throw new ConflictException("SLA policy revision is stale.");
      await transaction.slaPolicyTarget.deleteMany({
        where: { policyId: current.id, tenantId: identity.tenantId },
      });
      await transaction.slaPolicyTarget.createMany({
        data: input.targets.map((target) => ({
          ...target,
          policyId: current.id,
          tenantId: identity.tenantId,
        })),
      });
      await this.writePolicyEvent(transaction, identity, current.id, current.version + 1);
      return current.id;
    });
    const saved = await this.read(identity.tenantId);
    if (!saved || saved.id !== policyId)
      throw new Error("SLA policy could not be read after save.");
    return saved;
  }

  private async read(tenantId: string): Promise<SlaPolicyView | null> {
    const policy = await this.prisma.slaPolicy.findUnique({
      include: { targets: true },
      where: { tenantId },
    });
    if (!policy) return null;
    const targetsByPriority = new Map(policy.targets.map((target) => [target.priority, target]));
    return {
      autoCloseResolvedMinutes: policy.autoCloseResolvedMinutes,
      id: policy.id,
      targets: SLA_PRIORITIES.map((priority) => {
        const target = targetsByPriority.get(priority);
        if (!target) throw new Error(`SLA policy target ${priority} is missing.`);
        return {
          approachingBeforeMinutes: target.approachingBeforeMinutes,
          firstResponseMinutes: target.firstResponseMinutes,
          priority: target.priority,
          resolutionMinutes: target.resolutionMinutes,
        };
      }),
      updatedAtUtc: policy.updatedAt.toISOString(),
      version: policy.version,
    };
  }

  private assertRead(identity: AuthenticatedIdentity): void {
    if (!hasPermission(identity.role, "sla.read")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
  }

  private async writePolicyEvent(
    transaction: Parameters<SupportEventWriter["write"]>[0],
    identity: AuthenticatedIdentity,
    policyId: string,
    version: number,
  ): Promise<void> {
    await this.events.write(transaction, identity, {
      action: "sla.policy.changed",
      aggregateId: policyId,
      aggregateType: "sla_policy",
      eventType: "sla.policy-changed.v1",
      metadata: { version },
      payload: { policyId, version },
    });
  }
}
