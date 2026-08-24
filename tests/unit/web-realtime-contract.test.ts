import { describe, expect, it } from "vitest";

import { decodeRealtimeInvalidation } from "../../src/web/src/features/realtime/api/realtimeContract.js";
import { reconcileRealtimeSnapshot } from "../../src/web/src/features/realtime/model/realtimeClient.js";

describe("web realtime contract", () => {
  it("accepts the small invalidation contract", () => {
    expect(
      decodeRealtimeInvalidation({
        eventId: "event-1",
        occurredAtUtc: "2026-08-24T12:00:00.000Z",
        ticketId: "ticket-1",
        type: "ticket.assigned",
        version: 2,
      }),
    ).toMatchObject({ ticketId: "ticket-1", type: "ticket.assigned", version: 2 });
  });

  it("rejects payloads that try to introduce operational data through the event type", () => {
    expect(() =>
      decodeRealtimeInvalidation({
        eventId: "event-1",
        occurredAtUtc: "2026-08-24T12:00:00.000Z",
        queueId: "hidden-queue",
        ticketId: "ticket-1",
        type: "ticket.queue_details",
        version: 2,
      }),
    ).toThrow("realtime invalidation.type is invalid");
  });
});

describe("web realtime reconciliation", () => {
  it("forces a REST reconciliation on every successful reconnect", () => {
    const next = reconcileRealtimeSnapshot({
      eventRevision: 4,
      lastEvent: null,
      reconciliationRevision: 2,
      status: "RECONNECTING",
    });

    expect(next).toMatchObject({
      eventRevision: 4,
      reconciliationRevision: 3,
      status: "CONNECTED",
    });
  });
});
