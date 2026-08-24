import { describe, expect, it, vi } from "vitest";

import { RealtimeGateway } from "../../src/server/modules/realtime/presentation/realtime.gateway.js";
import {
  realtimeQueueRoom,
  realtimeRoleRoom,
  realtimeUserRoom,
} from "../../src/server/modules/realtime/domain/realtime-rooms.js";
import type { SessionInvalidation } from "../../src/server/platform/index.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000101";
const MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000201";
const SESSION_ID = "00000000-0000-4000-8000-000000000601";
const USER_ID = "00000000-0000-4000-8000-000000000501";
const QUEUE_ID = "00000000-0000-4000-8000-000000000301";

describe("realtime gateway security", () => {
  it("joins only server-derived user, role, and active queue rooms", async () => {
    const joined = vi.fn();
    const gateway = createGateway(() => undefined);
    await gateway.handleConnection({
      data: { identity: socketIdentity() },
      disconnect: vi.fn(),
      join: joined,
    } as never);

    expect(joined).toHaveBeenCalledWith([
      realtimeUserRoom(TENANT_ID, USER_ID),
      realtimeRoleRoom(TENANT_ID, "AGENT"),
      realtimeQueueRoom(TENANT_ID, QUEUE_ID),
    ]);
  });

  it("cannot join a queue room when the server returns no active membership", async () => {
    const joined = vi.fn();
    const gateway = createGateway(() => undefined, []);
    await gateway.handleConnection({
      data: { identity: socketIdentity() },
      disconnect: vi.fn(),
      join: joined,
    } as never);

    expect(joined).toHaveBeenCalledWith([
      realtimeUserRoom(TENANT_ID, USER_ID),
      realtimeRoleRoom(TENANT_ID, "AGENT"),
    ]);
  });

  it("disconnects a revoked session immediately", async () => {
    let listener: ((event: SessionInvalidation) => void) | undefined;
    const disconnected = vi.fn();
    const sockets = new Map([
      [
        "socket-1",
        {
          data: { identity: socketIdentity() },
          disconnect: () => {
            disconnected();
            sockets.delete("socket-1");
          },
        },
      ],
    ]);
    const gateway = createGateway((next) => {
      listener = next;
    });
    Object.assign(gateway, { namespace: { sockets } });
    gateway.onApplicationBootstrap();

    listener?.({ id: SESSION_ID, scope: "SESSION" });

    expect(disconnected).toHaveBeenCalledOnce();
    expect(sockets.size).toBe(0);
    await gateway.beforeApplicationShutdown();
  });
});

function createGateway(
  capture: (listener: (event: SessionInvalidation) => void) => void,
  queueIds: readonly string[] = [QUEUE_ID],
): RealtimeGateway {
  return new RealtimeGateway(
    { values: { realtimeAuthRecheckMs: 60_000, webOrigin: "http://127.0.0.1:5173" } } as never,
    { listActiveQueueIds: () => Promise.resolve(queueIds) } as never,
    {
      subscribe: (listener: (event: SessionInvalidation) => void) => {
        capture(listener);
        return () => undefined;
      },
    } as never,
  );
}

function socketIdentity() {
  return {
    membershipId: MEMBERSHIP_ID,
    role: "AGENT" as const,
    sessionId: SESSION_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
  };
}
