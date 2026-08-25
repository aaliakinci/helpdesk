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
  it("rejects untrusted origins and rate-limits repeated handshakes", async () => {
    let middleware: ((socket: never, next: (error?: Error) => void) => void) | undefined;
    const gateway = createGateway(() => undefined, [], {
      websocketConnectionLimit: 1,
      websocketConnectionWindowSeconds: 60,
    });
    gateway.afterInit({ use: (next: typeof middleware) => (middleware = next) } as never);
    const untrustedError = await invokeMiddleware(middleware, handshakeSocket("https://evil.test"));
    const acceptedError = await invokeMiddleware(
      middleware,
      handshakeSocket("http://127.0.0.1:5173", "198.51.100.11"),
    );
    const limitedError = await invokeMiddleware(
      middleware,
      handshakeSocket("http://127.0.0.1:5173", "198.51.100.11"),
    );

    expect(untrustedError?.message).toBe("Origin is not allowed.");
    expect(acceptedError).toBeUndefined();
    expect(limitedError?.message).toBe("Connection rate limit exceeded.");
  });

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
  security: {
    readonly websocketConnectionLimit?: number;
    readonly websocketConnectionWindowSeconds?: number;
  } = {},
): RealtimeGateway {
  return new RealtimeGateway(
    {
      values: {
        realtimeAuthRecheckMs: 60_000,
        webOrigin: "http://127.0.0.1:5173",
        websocketConnectionLimit: security.websocketConnectionLimit ?? 30,
        websocketConnectionWindowSeconds: security.websocketConnectionWindowSeconds ?? 60,
      },
    } as never,
    {
      authenticateAccessToken: () => Promise.resolve(socketIdentity()),
      listActiveQueueIds: () => Promise.resolve(queueIds),
    } as never,
    {
      subscribe: (listener: (event: SessionInvalidation) => void) => {
        capture(listener);
        return () => undefined;
      },
    } as never,
  );
}

function handshakeSocket(origin: string, address = "198.51.100.10") {
  return {
    data: {},
    handshake: { address, auth: { accessToken: "valid-token" }, headers: { origin } },
    id: `socket-${address}`,
  };
}

function invokeMiddleware(
  middleware: ((socket: never, next: (error?: Error) => void) => void) | undefined,
  socket: ReturnType<typeof handshakeSocket>,
): Promise<Error | undefined> {
  if (!middleware) throw new Error("Realtime middleware was not registered.");
  return new Promise((resolve) => middleware(socket as never, resolve));
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
