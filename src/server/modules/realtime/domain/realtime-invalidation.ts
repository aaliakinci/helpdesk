import type { IntegrationEventEnvelope } from "../../messaging/domain/integration-event-envelope.js";

export const REALTIME_EVENT_NAME = "support.invalidate";

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

export interface RealtimeEventProjection {
  readonly invalidation: RealtimeInvalidation;
  readonly relatedQueueIds: readonly string[];
  readonly requesterVisible: boolean;
}

export function projectRealtimeEvent(
  envelope: IntegrationEventEnvelope,
): RealtimeEventProjection | null {
  if (
    envelope.type !== "ticket.created.v1" &&
    envelope.type !== "ticket.assignment-changed.v1" &&
    envelope.type !== "ticket.status-changed.v1" &&
    envelope.type !== "ticket.comment.added.v1" &&
    envelope.type !== "ticket.attachment-added.v1" &&
    envelope.type !== "ticket.priority-changed.v1" &&
    envelope.type !== "ticket.sla-warning.v1"
  ) {
    return null;
  }
  const payload = asRecord(envelope.payload);
  const common = {
    eventId: envelope.messageId,
    occurredAtUtc: envelope.occurredAtUtc,
    ticketId: requireUuid(payload.ticketId, "ticketId"),
    version: requirePositiveInteger(payload.version, "version"),
  } as const;

  switch (envelope.type) {
    case "ticket.created.v1":
      return {
        invalidation: { ...common, type: "ticket.created" },
        relatedQueueIds: [],
        requesterVisible: true,
      };
    case "ticket.assignment-changed.v1":
      return {
        invalidation: { ...common, type: "ticket.assigned" },
        relatedQueueIds: readQueueIds(payload),
        requesterVisible: true,
      };
    case "ticket.status-changed.v1":
      return {
        invalidation: { ...common, type: "ticket.status_changed" },
        relatedQueueIds: [],
        requesterVisible: true,
      };
    case "ticket.comment.added.v1": {
      const visibility = payload.visibility;
      if (visibility !== "PUBLIC" && visibility !== "INTERNAL") {
        throw new Error("visibility is invalid.");
      }
      return {
        invalidation: { ...common, type: "ticket.comment_added" },
        relatedQueueIds: [],
        requesterVisible: visibility === "PUBLIC",
      };
    }
    case "ticket.attachment-added.v1": {
      const visibility = payload.visibility;
      if (visibility !== "PUBLIC" && visibility !== "INTERNAL") {
        throw new Error("visibility is invalid.");
      }
      return {
        invalidation: { ...common, type: "ticket.attachment_added" },
        relatedQueueIds: [],
        requesterVisible: visibility === "PUBLIC",
      };
    }
    case "ticket.priority-changed.v1":
      return {
        invalidation: { ...common, type: "ticket.priority_changed" },
        relatedQueueIds: [],
        requesterVisible: true,
      };
    case "ticket.sla-warning.v1":
      return {
        invalidation: { ...common, type: "ticket.sla_warning" },
        relatedQueueIds: [],
        requesterVisible: false,
      };
    default:
      return null;
  }
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Realtime event payload must be an object.");
  }
  return value as Readonly<Record<string, unknown>>;
}

function readQueueIds(payload: Readonly<Record<string, unknown>>): readonly string[] {
  const queueIds = [payload.fromQueueId, payload.toQueueId]
    .filter((value): value is string => typeof value === "string")
    .map((value) => requireUuid(value, "queueId"));
  return [...new Set(queueIds)];
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

function requireUuid(value: unknown, name: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  ) {
    throw new Error(`${name} must be a UUID.`);
  }
  return value;
}
