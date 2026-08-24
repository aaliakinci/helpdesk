import { describe, expect, it } from "vitest";

import {
  decodeIntegrationEventEnvelope,
  decodeTicketCreatedPayload,
} from "../../src/server/modules/messaging/domain/integration-event-envelope.js";
import {
  readDeliveryAttempt,
  resolveDeliveryFailure,
  retryDelayMilliseconds,
} from "../../src/server/modules/messaging/domain/retry-policy.js";

const validEnvelope = {
  aggregateId: "00000000-0000-4000-8000-000000000101",
  causationId: "request-42",
  correlationId: "ticket-flow:42",
  messageId: "00000000-0000-4000-8000-000000000201",
  occurredAtUtc: "2026-08-24T15:00:00.000Z",
  payload: {
    priority: "NORMAL",
    status: "NEW",
    ticketId: "00000000-0000-4000-8000-000000000101",
    ticketNumber: 42,
    version: 1,
  },
  schemaVersion: 1,
  tenantId: "00000000-0000-4000-8000-000000000301",
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  type: "ticket.created.v1",
};

describe("integration event envelope", () => {
  it("validates the envelope and event-specific payload at the trust boundary", () => {
    const envelope = decodeIntegrationEventEnvelope(validEnvelope);
    expect(envelope.messageId).toBe(validEnvelope.messageId);
    expect(decodeTicketCreatedPayload(envelope.payload)).toMatchObject({
      ticketId: validEnvelope.payload.ticketId,
      ticketNumber: 42,
    });
  });

  it("rejects malformed identity and trace fields", () => {
    expect(() =>
      decodeIntegrationEventEnvelope({ ...validEnvelope, messageId: "not-a-uuid" }),
    ).toThrow("messageId must be a UUID");
    expect(() =>
      decodeIntegrationEventEnvelope({ ...validEnvelope, traceparent: "invalid" }),
    ).toThrow("traceparent is invalid");
  });
});

describe("messaging retry policy", () => {
  it("uses bounded exponential delays and sanitizes broker headers", () => {
    expect([1, 2, 3, 9].map(retryDelayMilliseconds)).toEqual([1_000, 5_000, 30_000, 30_000]);
    expect(readDeliveryAttempt(2)).toBe(2);
    expect(readDeliveryAttempt("2")).toBe(0);
    expect(readDeliveryAttempt(-1)).toBe(0);
    expect(resolveDeliveryFailure(0, 5)).toEqual({
      delayMilliseconds: 1_000,
      nextAttempt: 1,
      terminal: false,
    });
    expect(resolveDeliveryFailure(4, 5)).toEqual({ nextAttempt: 5, terminal: true });
  });
});
