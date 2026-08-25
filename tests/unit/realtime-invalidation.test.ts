import { describe, expect, it } from "vitest";

import { projectRealtimeEvent } from "../../src/server/modules/realtime/domain/realtime-invalidation.js";
import type { IntegrationEventEnvelope } from "../../src/server/modules/messaging/domain/integration-event-envelope.js";

const MESSAGE_ID = "00000000-0000-4000-8000-000000000701";
const TENANT_ID = "00000000-0000-4000-8000-000000000101";
const TICKET_ID = "00000000-0000-4000-8000-000000000501";
const QUEUE_ID = "00000000-0000-4000-8000-000000000301";

describe("realtime invalidation projection", () => {
  it("projects only a small invalidation and keeps queue data server-side", () => {
    const projection = projectRealtimeEvent(
      envelope("ticket.assignment-changed.v1", {
        ticketId: TICKET_ID,
        toAssigneeMembershipId: "00000000-0000-4000-8000-000000000201",
        toQueueId: QUEUE_ID,
        version: 2,
      }),
    );

    expect(projection).toMatchObject({
      invalidation: {
        eventId: MESSAGE_ID,
        ticketId: TICKET_ID,
        type: "ticket.assigned",
        version: 2,
      },
      relatedQueueIds: [QUEUE_ID],
      requesterVisible: true,
    });
    expect(projection?.invalidation).not.toHaveProperty("queueId");
    expect(projection?.invalidation).not.toHaveProperty("assigneeMembershipId");
  });

  it("never marks an internal note as requester-visible", () => {
    const projection = projectRealtimeEvent(
      envelope("ticket.comment.added.v1", {
        ticketId: TICKET_ID,
        version: 3,
        visibility: "INTERNAL",
      }),
    );

    expect(projection).toMatchObject({ requesterVisible: false });
  });

  it("keeps internal attachment metadata out of requester audiences", () => {
    const projection = projectRealtimeEvent(
      envelope("ticket.attachment-added.v1", {
        attachmentId: "00000000-0000-4000-8000-000000000801",
        ticketId: TICKET_ID,
        version: 3,
        visibility: "INTERNAL",
      }),
    );

    expect(projection).toMatchObject({
      invalidation: { ticketId: TICKET_ID, type: "ticket.attachment_added", version: 3 },
      requesterVisible: false,
    });
    expect(projection?.invalidation).not.toHaveProperty("attachmentId");
  });

  it("ignores integration events that have no browser invalidation contract", () => {
    expect(projectRealtimeEvent(envelope("queue.updated.v1", {}))).toBeNull();
  });
});

function envelope(
  type: string,
  payload: Readonly<Record<string, unknown>>,
): IntegrationEventEnvelope {
  return {
    aggregateId: TICKET_ID,
    causationId: null,
    correlationId: null,
    messageId: MESSAGE_ID,
    occurredAtUtc: "2026-08-24T12:00:00.000Z",
    payload,
    schemaVersion: 1,
    tenantId: TENANT_ID,
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    type,
  };
}
