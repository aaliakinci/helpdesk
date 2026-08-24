import { describe, expect, it } from "vitest";

import { RealtimeAudienceService } from "../../src/server/modules/realtime/application/realtime-audience.service.js";
import type { RealtimeEventProjection } from "../../src/server/modules/realtime/domain/realtime-invalidation.js";
import {
  realtimeQueueRoom,
  realtimeRoleRoom,
  realtimeUserRoom,
} from "../../src/server/modules/realtime/domain/realtime-rooms.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000102";
const QUEUE_ID = "00000000-0000-4000-8000-000000000301";
const REQUESTER_USER_ID = "00000000-0000-4000-8000-000000000201";

describe("realtime audience resolution", () => {
  it("targets queue members without broadcasting assigned work to queue outsiders", async () => {
    const service = audience({ currentQueueId: QUEUE_ID, requesterContact: { userId: null } });
    const resolved = await service.resolve(TENANT_ID, projection(false));

    expect(resolved?.rooms).toContain(realtimeQueueRoom(TENANT_ID, QUEUE_ID));
    expect(resolved?.rooms).not.toContain(realtimeRoleRoom(TENANT_ID, "AGENT"));
    expect(resolved?.rooms.every((room) => !room.includes(OTHER_TENANT_ID))).toBe(true);
  });

  it("includes the requester user room for public events only", async () => {
    const service = audience({
      currentQueueId: QUEUE_ID,
      requesterContact: { userId: REQUESTER_USER_ID },
    });

    const publicAudience = await service.resolve(TENANT_ID, projection(true));
    const internalAudience = await service.resolve(TENANT_ID, projection(false));

    expect(publicAudience?.rooms).toContain(realtimeUserRoom(TENANT_ID, REQUESTER_USER_ID));
    expect(internalAudience?.rooms).not.toContain(realtimeUserRoom(TENANT_ID, REQUESTER_USER_ID));
  });

  it("does not expose one requester's ticket event to another requester", async () => {
    const service = audience({
      currentQueueId: null,
      requesterContact: { userId: REQUESTER_USER_ID },
    });
    const resolved = await service.resolve(TENANT_ID, projection(true));

    expect(resolved?.rooms).toContain(realtimeUserRoom(TENANT_ID, REQUESTER_USER_ID));
    expect(resolved?.rooms).not.toContain(
      realtimeUserRoom(TENANT_ID, "00000000-0000-4000-8000-000000000299"),
    );
  });
});

function audience(ticket: {
  readonly currentQueueId: string | null;
  readonly requesterContact: { readonly userId: string | null };
}): RealtimeAudienceService {
  return new RealtimeAudienceService({
    ticket: { findUnique: () => Promise.resolve(ticket) },
  } as never);
}

function projection(requesterVisible: boolean): RealtimeEventProjection {
  return {
    invalidation: {
      eventId: "00000000-0000-4000-8000-000000000701",
      occurredAtUtc: "2026-08-24T12:00:00.000Z",
      ticketId: "00000000-0000-4000-8000-000000000501",
      type: "ticket.comment_added",
      version: 2,
    },
    relatedQueueIds: [],
    requesterVisible,
  };
}
