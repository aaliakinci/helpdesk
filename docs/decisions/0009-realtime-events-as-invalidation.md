# ADR-0009: Realtime events as invalidation

Status: Accepted

Date: 2026-08-23

## Context

WebSocket delivery can be delayed, duplicated, missed during disconnect, or observed out of order. Treating socket payloads as a second authoritative entity store would create difficult consistency failures.

## Decision

Realtime events are small invalidation signals. They carry event ID, type, tenant/audience information, resource ID, and resource revision; they do not replace the REST representation. Feature handlers invalidate or reload visible server queries. Reconnect performs REST/cursor reconciliation.

The NestJS gateway authenticates the session and derives user/queue rooms from trusted membership and permissions. Clients cannot choose arbitrary tenant rooms. Redis is used only for Socket.IO multi-instance scale-out. If Redis or WebSocket is unavailable, REST refresh remains correct.

Internal-note events and data are never sent to requester audiences.

## Consequences

Realtime UX may perform extra reads, but correctness and recovery stay simple. Each feature owns how its query reacts to an event.

## Verification

Integration/E2E tests cover tenant and queue room authorization, requester privacy, revoked sessions, duplicate/out-of-order signals, disconnect windows, reconnect reconciliation, and Redis failure.

## Revisit when

Measured request volume makes refetch-based reconciliation too expensive and a versioned patch protocol can be proven safe.
