import {
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export type AuditActorType = "SYSTEM" | "USER";

export interface AuditEntryView {
  readonly action: string;
  readonly actor: {
    readonly displayName: string | null;
    readonly id: string | null;
    readonly type: AuditActorType;
  };
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly id: string;
  readonly metadata: Readonly<Record<string, boolean | number | string | null>> | null;
  readonly occurredAtUtc: string;
}

export interface AuditPage {
  readonly items: readonly AuditEntryView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export function decodeAuditPage(body: unknown): AuditPage {
  const value = requireRecord(body, "audit page");
  return {
    items: requireArray(value.items, "audit items").map(decodeAuditEntry),
    page: requirePositiveInteger(value.page, "audit page number"),
    pageSize: requirePositiveInteger(value.pageSize, "audit page size"),
    total: requireNonNegativeInteger(value.total, "audit total"),
    totalPages: requireNonNegativeInteger(value.totalPages, "audit totalPages"),
  };
}

function decodeAuditEntry(body: unknown): AuditEntryView {
  const value = requireRecord(body, "audit entry");
  const actor = requireRecord(value.actor, "audit actor");
  const actorType = requireString(actor.type, "audit actor.type");
  if (actorType !== "SYSTEM" && actorType !== "USER") {
    throw new TypeError("audit actor.type is invalid.");
  }
  return {
    action: requireString(value.action, "audit action"),
    actor: {
      displayName: optionalNullableString(actor.displayName, "audit actor.displayName"),
      id: optionalNullableString(actor.id, "audit actor.id"),
      type: actorType,
    },
    aggregateId: requireString(value.aggregateId, "audit aggregateId"),
    aggregateType: requireString(value.aggregateType, "audit aggregateType"),
    id: requireString(value.id, "audit id"),
    metadata: decodeMetadata(value.metadata),
    occurredAtUtc: requireString(value.occurredAtUtc, "audit occurredAtUtc"),
  };
}

function decodeMetadata(
  body: unknown,
): Readonly<Record<string, boolean | number | string | null>> | null {
  if (body === null) return null;
  const value = requireRecord(body, "audit metadata");
  const result: Record<string, boolean | number | string | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      item !== null &&
      typeof item !== "boolean" &&
      typeof item !== "number" &&
      typeof item !== "string"
    ) {
      throw new TypeError(`audit metadata.${key} is invalid.`);
    }
    result[key] = item;
  }
  return result;
}

function optionalNullableString(value: unknown, name: string): string | null {
  return value === null ? null : requireString(value, name);
}

function requirePositiveInteger(value: unknown, name: string): number {
  const number = requireNumber(value, name);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`${name} is invalid.`);
  return number;
}

function requireNonNegativeInteger(value: unknown, name: string): number {
  const number = requireNumber(value, name);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${name} is invalid.`);
  return number;
}
