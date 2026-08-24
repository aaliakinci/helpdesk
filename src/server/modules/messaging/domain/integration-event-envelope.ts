import { normalizeTraceparent } from "../../../platform/index.js";

export interface IntegrationEventEnvelope {
  readonly aggregateId: string;
  readonly causationId: string | null;
  readonly correlationId: string | null;
  readonly messageId: string;
  readonly occurredAtUtc: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly schemaVersion: number;
  readonly tenantId: string;
  readonly traceparent: string;
  readonly type: string;
}

export interface TicketCreatedPayload {
  readonly priority: string;
  readonly status: string;
  readonly ticketId: string;
  readonly ticketNumber: number;
  readonly version: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE = /^[a-z][a-z0-9.-]{2,119}$/;

export function decodeIntegrationEventEnvelope(value: unknown): IntegrationEventEnvelope {
  const input = asRecord(value, "Event envelope");
  const messageId = asUuid(input.messageId, "messageId");
  const tenantId = asUuid(input.tenantId, "tenantId");
  const aggregateId = asUuid(input.aggregateId, "aggregateId");
  const type = asString(input.type, "type", 120);
  if (!EVENT_TYPE.test(type)) throw new Error("type has an invalid format.");
  if (!Number.isInteger(input.schemaVersion) || Number(input.schemaVersion) < 1) {
    throw new Error("schemaVersion must be a positive integer.");
  }
  const occurredAtUtc = asString(input.occurredAtUtc, "occurredAtUtc", 40);
  if (Number.isNaN(Date.parse(occurredAtUtc))) throw new Error("occurredAtUtc is invalid.");
  const traceparent = normalizeTraceparent(input.traceparent);
  if (!traceparent) throw new Error("traceparent is invalid.");

  return {
    aggregateId,
    causationId: asNullableString(input.causationId, "causationId", 128),
    correlationId: asNullableString(input.correlationId, "correlationId", 128),
    messageId,
    occurredAtUtc,
    payload: asRecord(input.payload, "payload"),
    schemaVersion: Number(input.schemaVersion),
    tenantId,
    traceparent,
    type,
  };
}

export function decodeTicketCreatedPayload(value: unknown): TicketCreatedPayload {
  const input = asRecord(value, "ticket.created payload");
  const ticketNumber = Number(input.ticketNumber);
  const version = Number(input.version);
  if (!Number.isInteger(ticketNumber) || ticketNumber < 1) {
    throw new Error("ticketNumber must be a positive integer.");
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("version must be a positive integer.");
  }
  return {
    priority: asString(input.priority, "priority", 20),
    status: asString(input.status, "status", 20),
    ticketId: asUuid(input.ticketId, "ticketId"),
    ticketNumber,
    version,
  };
}

function asRecord(value: unknown, name: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function asString(value: unknown, name: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new Error(`${name} must be a non-empty string with at most ${maximum} characters.`);
  }
  return value;
}

function asNullableString(value: unknown, name: string, maximum: number): string | null {
  if (value === null || value === undefined) return null;
  return asString(value, name, maximum);
}

function asUuid(value: unknown, name: string): string {
  const candidate = asString(value, name, 36);
  if (!UUID.test(candidate)) throw new Error(`${name} must be a UUID.`);
  return candidate;
}
