# Realtime delivery and security

Realtime delivery improves freshness; it is not a second data source. Every browser event is a small invalidation containing only an event ID, event type, ticket ID, occurrence time, and ticket version. Ticket lists, details, queue data, and notifications are always read again through the authorized REST API.

## Authentication and rooms

The Socket.IO namespace is `/support`, uses WebSocket transport, and accepts only the configured `WEB_ORIGIN`. The browser supplies its in-memory access token during the namespace handshake. The API validates the token against the current database session, user, tenant, and membership state before accepting the connection.

Room names are derived on the server. The client cannot request or join a tenant, role, user, or queue room.

- Every connection joins its tenant-scoped user and role rooms.
- An Agent joins only active queues where its active membership is recorded.
- Owner, Manager, and Auditor audiences are selected through tenant-scoped role rooms.
- Requester delivery uses the ticket's linked requester user and never a client-supplied identifier.

Session revocation, refresh rotation, tenant switching, role changes, membership status changes, and queue membership changes disconnect affected sockets. A periodic database-backed authentication check is a fallback. Reconnection authenticates again and derives a fresh room set.

## Requester privacy

Requester sockets receive invalidations only for their own ticket. Public comments can invalidate their ticket view; internal notes and SLA warnings do not produce requester delivery. Assignment invalidations contain no queue or assignee identifiers. The following is the complete browser payload shape:

```json
{
  "eventId": "UUID",
  "occurredAtUtc": "2026-08-24T15:00:00.000Z",
  "ticketId": "UUID",
  "type": "ticket.assigned",
  "version": 2
}
```

Requester REST projections independently enforce the same privacy boundary, so inspecting network responses does not reveal queue, assignee, or staff-only history.

## Delivery topology and recovery

The API consumes `helpdesk.realtime.v1`, a durable queue separate from the worker queue. This prevents realtime consumers from competing with business-process consumers. Failed realtime projection deliveries use dedicated retry queues and `helpdesk.realtime.dlq.v1`.

The API resolves authorized rooms from PostgreSQL and emits the invalidation through the Socket.IO Redis adapter. Redis distributes it across API instances. RabbitMQ carries durable integration events; Redis carries ephemeral socket fan-out.

The web client maintains one connection for the application session, deduplicates event IDs, and refetches affected REST queries. Every successful initial connection or reconnection increments a reconciliation cursor and refetches visible ticket, queue, and notification data. Events missed while disconnected are therefore recovered from PostgreSQL. If RabbitMQ, Redis, or WebSocket delivery is unavailable, ordinary REST reads and manual refresh remain correct.
