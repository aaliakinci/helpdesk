import { requireNumber, requireRecord, requireString } from "@/shared/api/contractDecoder";

export type RealtimeInvalidationType =
  | "ticket.assigned"
  | "ticket.attachment_added"
  | "ticket.comment_added"
  | "ticket.created"
  | "ticket.priority_changed"
  | "ticket.sla_warning"
  | "ticket.status_changed";

export interface RealtimeInvalidation {
  readonly eventId: string;
  readonly occurredAtUtc: string;
  readonly ticketId: string;
  readonly type: RealtimeInvalidationType;
  readonly version: number;
}

const TYPES: readonly RealtimeInvalidationType[] = [
  "ticket.assigned",
  "ticket.attachment_added",
  "ticket.comment_added",
  "ticket.created",
  "ticket.priority_changed",
  "ticket.sla_warning",
  "ticket.status_changed",
];

export function decodeRealtimeInvalidation(value: unknown): RealtimeInvalidation {
  const record = requireRecord(value, "realtime invalidation");
  const type = requireString(record.type, "realtime invalidation.type");
  if (!TYPES.includes(type as RealtimeInvalidationType)) {
    throw new TypeError("realtime invalidation.type is invalid.");
  }
  const version = requireNumber(record.version, "realtime invalidation.version");
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError("realtime invalidation.version must be a positive integer.");
  }
  return {
    eventId: requireString(record.eventId, "realtime invalidation.eventId"),
    occurredAtUtc: requireString(record.occurredAtUtc, "realtime invalidation.occurredAtUtc"),
    ticketId: requireString(record.ticketId, "realtime invalidation.ticketId"),
    type: type as RealtimeInvalidationType,
    version,
  };
}
