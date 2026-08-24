# SLA operations

The platform models first-response and resolution targets as elapsed wall-clock durations. All due
instants are PostgreSQL `timestamptz` values representing UTC instants. A tenant time zone changes
formatting in the web application, never the calculation. Pending status does not pause either
clock; business-hours and holiday calendars are intentionally outside this model.

## Policy and snapshots

Each tenant has one optimistic-revision SLA policy with exactly one target for every ticket
priority. A target contains first-response minutes, resolution minutes, and a warning lead time.
The policy also defines automatic close delay after resolution; the supported range is 60 to
43,200 minutes and the demo default is 4,320 minutes (72 hours).

Ticket creation copies the applied policy version, priority, durations, warning lead time,
auto-close delay, and calculated due instants into `ticket_sla_states`. Later policy edits affect
new tickets only. A tenant without a policy can still create tickets; those tickets remain
explicitly outside SLA tracking rather than being retroactively reinterpreted.

First response completes only on the first public reply written by an Agent or Manager. Requester
comments and internal notes do not count. Resolution completes on the first transition to
Resolved. Reopening a Resolved ticket cancels its pending auto-close but does not rewrite the first
resolution evidence.

## Scheduling and idempotency

The worker uses the database clock and a bounded `FOR UPDATE SKIP LOCKED` query. It transitions each
milestone from Active to Approaching to Breached, or to Completed through the ticket transaction.
A scan that starts after the due instant can move directly from Active to Breached.

Every warning transaction creates one outbox event and one in-app notification per distinct active
Owner, Manager, and assigned Agent membership. Notification-delivery keys contain the ticket,
milestone, warning stage, and recipient membership, making retry duplicates deterministically
rejectable. Stored transition state ensures repeated scheduler scans do not emit warning spam.

Automatic close uses the same scheduler boundary. When `auto_close_at` is due and the ticket is
still Resolved, the worker writes Closed status, SYSTEM history, audit, and outbox atomically.

## Dashboard correctness

The operations dashboard reads open, unassigned, approaching, breached, queue, and Agent workload
projections directly from PostgreSQL. Redis is not part of the query path, so Redis loss can affect
realtime freshness but cannot change dashboard correctness. Realtime messages remain invalidation
signals; the browser always retrieves authorized data again through REST.
