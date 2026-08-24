import { io, type Socket } from "socket.io-client";

import { decodeRealtimeInvalidation, type RealtimeInvalidation } from "../api/realtimeContract";

export type RealtimeConnectionStatus =
  "AUTH_FAILED" | "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "RECONNECTING";

export interface RealtimeSnapshot {
  readonly eventRevision: number;
  readonly lastEvent: RealtimeInvalidation | null;
  readonly reconciliationRevision: number;
  readonly status: RealtimeConnectionStatus;
}

let snapshot: RealtimeSnapshot = {
  eventRevision: 0,
  lastEvent: null,
  reconciliationRevision: 0,
  status: "DISCONNECTED",
};
let socket: Socket | null = null;
let sessionKey: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
const listeners = new Set<() => void>();
const receivedEventIds = new Set<string>();

export const realtimeClient = {
  getSnapshot: (): RealtimeSnapshot => snapshot,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSession: (accessToken: string | null, nextSessionKey: string | null): void => {
    if (accessToken && nextSessionKey && sessionKey === nextSessionKey && socket) {
      socket.auth = { accessToken };
      return;
    }
    stop();
    sessionKey = nextSessionKey;
    if (!accessToken || !nextSessionKey) return;
    connect(accessToken);
  },
};

function connect(accessToken: string): void {
  update({ ...snapshot, status: reconnectAttempt > 0 ? "RECONNECTING" : "CONNECTING" });
  const next = io("/support", {
    auth: { accessToken },
    path: "/socket.io",
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    transports: ["websocket"],
  });
  socket = next;
  next.on("connect", () => {
    reconnectAttempt = 0;
    update(reconcileRealtimeSnapshot(snapshot));
  });
  next.on("disconnect", (reason) => {
    if (socket !== next) return;
    update({ ...snapshot, status: "DISCONNECTED" });
    if (reason === "io server disconnect") scheduleServerReconnect(next);
  });
  next.io.on("reconnect_attempt", () => update({ ...snapshot, status: "RECONNECTING" }));
  next.on("connect_error", (error) => {
    if (socket !== next) return;
    const authenticationFailure =
      error.message.includes("Authentication") ||
      error.message.includes("Session") ||
      error.message.includes("Origin");
    update({ ...snapshot, status: authenticationFailure ? "AUTH_FAILED" : "RECONNECTING" });
  });
  next.on("support.invalidate", (value: unknown) => {
    try {
      const event = decodeRealtimeInvalidation(value);
      if (receivedEventIds.has(event.eventId)) return;
      rememberEvent(event.eventId);
      update({ ...snapshot, eventRevision: snapshot.eventRevision + 1, lastEvent: event });
    } catch {
      // Invalid socket data is intentionally ignored; REST remains authoritative.
    }
  });
}

export function reconcileRealtimeSnapshot(current: RealtimeSnapshot): RealtimeSnapshot {
  return {
    ...current,
    reconciliationRevision: current.reconciliationRevision + 1,
    status: "CONNECTED",
  };
}

function scheduleServerReconnect(current: Socket): void {
  if (reconnectTimer || socket !== current) return;
  reconnectAttempt += 1;
  const delay = Math.min(10_000, 500 * 2 ** Math.min(reconnectAttempt, 5));
  update({ ...snapshot, status: "RECONNECTING" });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (socket === current) current.connect();
  }, delay);
}

function stop(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectAttempt = 0;
  socket?.removeAllListeners();
  socket?.io.removeAllListeners();
  socket?.disconnect();
  socket = null;
  sessionKey = null;
  receivedEventIds.clear();
  update({ ...snapshot, lastEvent: null, status: "DISCONNECTED" });
}

function rememberEvent(eventId: string): void {
  receivedEventIds.add(eventId);
  if (receivedEventIds.size <= 200) return;
  const oldest = receivedEventIds.values().next().value;
  if (oldest) receivedEventIds.delete(oldest);
}

function update(next: RealtimeSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
