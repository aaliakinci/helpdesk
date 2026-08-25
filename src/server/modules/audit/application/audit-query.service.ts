import { ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../platform/index.js";
import type { AuthenticatedIdentity } from "../../identity/domain/identity.types.js";
import { hasPermission } from "../../identity/domain/permissions.js";

export interface AuditListInput {
  readonly action: string | null;
  readonly actorType: "SYSTEM" | "USER" | null;
  readonly actorUserId: string | null;
  readonly aggregateType: string | null;
  readonly from: Date | null;
  readonly page: number;
  readonly pageSize: number;
  readonly to: Date | null;
}

export interface AuditPage {
  readonly items: readonly AuditItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface AuditItem {
  readonly action: string;
  readonly actor: {
    readonly displayName: string | null;
    readonly id: string | null;
    readonly type: "SYSTEM" | "USER";
  };
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly id: string;
  readonly metadata: Readonly<Record<string, boolean | number | string | null>> | null;
  readonly occurredAtUtc: string;
}

const SAFE_METADATA_KEYS = new Set([
  "action",
  "attachmentId",
  "byteSize",
  "commentId",
  "contentType",
  "from",
  "fromAssigneeMembershipId",
  "fromQueueId",
  "fromStatus",
  "membershipId",
  "milestone",
  "stage",
  "status",
  "to",
  "toAssigneeMembershipId",
  "toQueueId",
  "toStatus",
  "version",
  "visibility",
]);

@Injectable()
export class AuditQueryService {
  public constructor(private readonly prisma: PrismaService) {}

  public async list(identity: AuthenticatedIdentity, input: AuditListInput): Promise<AuditPage> {
    if (!hasPermission(identity.role, "audit.read")) {
      throw new ForbiddenException("The operation is not permitted.");
    }
    const where = {
      tenantId: identity.tenantId,
      ...(input.action ? { action: input.action } : {}),
      ...(input.actorType ? { actorType: input.actorType } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.aggregateType ? { aggregateType: input.aggregateType } : {}),
      ...(input.from || input.to
        ? {
            occurredAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    } as const;
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.auditEntry.count({ where }),
      this.prisma.auditEntry.findMany({
        include: { actor: { select: { displayName: true, id: true } } },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
    ]);
    return {
      items: entries.map((entry) => ({
        action: entry.action,
        actor: {
          displayName: entry.actor?.displayName ?? null,
          id: entry.actor?.id ?? null,
          type: entry.actorType,
        },
        aggregateId: entry.aggregateId,
        aggregateType: entry.aggregateType,
        id: entry.id,
        metadata: sanitizeMetadata(entry.metadata),
        occurredAtUtc: entry.occurredAt.toISOString(),
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }
}

export function sanitizeMetadata(
  value: unknown,
): Readonly<Record<string, boolean | number | string | null>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const safe: Record<string, boolean | number | string | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number" ||
      typeof item === "string"
    ) {
      safe[key] = item;
    }
  }
  return Object.keys(safe).length > 0 ? safe : null;
}
