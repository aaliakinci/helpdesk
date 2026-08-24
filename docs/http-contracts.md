# HTTP platform contracts

## Request identity

The API accepts bounded, log-safe `x-request-id` and `x-correlation-id` values. Unsafe or missing
request IDs are replaced with a UUID. Both values are returned as response headers. The request ID
is the public `traceId` used by health and error responses.

## Problem Details

HTTP failures use `application/problem+json` with these stable fields:

```json
{
  "type": "https://helpdesk.example/problems/resource.not_found",
  "title": "Not found",
  "status": 404,
  "detail": "The requested resource was not found.",
  "instance": "/missing",
  "code": "resource.not_found",
  "traceId": "request-id"
}
```

Query values are excluded from `instance` and structured logs. Unexpected exceptions return a
generic detail and never expose stack traces, credentials, or exception internals.

## Health and system status

- `GET /health/live` reports only process liveness.
- `GET /health/ready` returns `200` when all mandatory dependencies are up and `503` otherwise.
- `GET /api/v1/system/status` always returns `200` with the current readiness report so the public
  web screen can render individual dependency states.
- `GET /openapi.json` exposes the generated OpenAPI schema; `/openapi` hosts its browser UI.

Readiness checks are named `postgresql`, `rabbitmq`, and `redis`, with `up` or `down` state and
bounded duration metadata. Responses do not include connection URLs or failure exception messages.

## Authentication and active tenant

- `POST /api/v1/auth/login` verifies credentials and either issues a tenant-bound session or asks
  the caller to select one of its active memberships.
- `POST /api/v1/auth/refresh` requires the trusted web `Origin` and rotates the opaque refresh
  cookie. Reuse of an already rotated token revokes the entire session family.
- `POST /api/v1/auth/logout` revokes the current family and clears the cookie.
- `POST /api/v1/auth/revoke-all` revokes every active session for the authenticated user.
- `POST /api/v1/auth/switch-tenant` validates the requested tenant against the authenticated user's
  active memberships and rotates the session into that membership.
- `GET /api/v1/auth/tenants` lists only the caller's active memberships.
- `GET /api/v1/identity/me` returns the user, membership, role, permissions, requester-contact link,
  and server-derived active tenant.

Protected endpoints accept `Authorization: Bearer <access-token>`. The API revalidates the access
token's session, user, membership, and tenant against PostgreSQL on every request. A tenant ID in a
request body is never accepted as data scope; tenant switch is the explicit exception and validates
membership ownership before changing context.

Membership reads and mutations are always scoped by `(tenant_id, id)`. A valid foreign-tenant UUID
therefore returns the same non-disclosing `404` as an unknown UUID. Role and status mutations also
enforce permissions inside the application use case and generate an identity audit entry.

## Customers and contacts

- `GET /api/v1/customers` and `GET /api/v1/customers/:customerId` return only active-tenant data.
- `POST /api/v1/customers` and `PATCH /api/v1/customers/:customerId` require customer-management
  permission.
- `POST /api/v1/customers/:customerId/contacts` and
  `PATCH /api/v1/customers/:customerId/contacts/:contactId` preserve the customer aggregate
  revision and same-tenant contact ownership.
- `GET /api/v1/customers/:customerId/history` returns customer and contact changes in reverse
  chronological order.

Customer and contact writes require `expectedVersion` after initial creation. A stale revision
returns `409` and does not partially update the aggregate or history.

## Tickets

- `GET /api/v1/tickets` supports bounded `page`, `pageSize`, `search`, `status`, `priority`,
  `queueId`, `assignment`, `sortBy`, and `sortDirection` parameters. `assignment` accepts `ALL`,
  `MINE`, or `UNASSIGNED`. Search covers ticket number, subject, description, and requester fields
  inside the server-derived tenant/requester scope.
- `POST /api/v1/tickets` creates a ticket, initial status history, audit entry, and
  `ticket.created.v1` outbox message in one transaction.
- `GET /api/v1/tickets/:ticketId` applies role-specific projection. Requesters can read only tickets
  attached to their server-derived customer contact and never receive internal comments, queue or
  assignee identities, assignment history, staff status history, or SLA operational data. Their list and detail
  projections expose only `assignmentStatus` as `ASSIGNED` or `UNASSIGNED`.
- `POST /api/v1/tickets/:ticketId/comments` creates a public reply or staff-only internal note and
  requires `expectedVersion`.
- `PATCH /api/v1/tickets/:ticketId/status` applies the fixed state machine and requires
  `expectedVersion`.
- `POST /api/v1/tickets/:ticketId/reopen` moves a resolved ticket to Open or creates a new linked
  ticket when the source is Closed.

Ticket numbers are allocated atomically per tenant. Every successful comment or status mutation
increments `version`; concurrent writes against the same revision produce one success and one
stable `409`. Closed tickets are terminal and immutable except through the explicit linked-reopen
operation.

## Queues, assignment, and operations

- `GET /api/v1/queues` returns tenant queues. Agents receive only queues where their active
  membership is enabled; Owner, Manager, and Auditor receive the tenant-wide read projection.
- `POST /api/v1/queues` and `PATCH /api/v1/queues/:queueId` require queue-management permission and
  use optimistic queue revisions.
- `GET /api/v1/queues/eligible-members` returns active Agent memberships to Owner and Manager.
- `POST /api/v1/queues/:queueId/members` adds, enables, or disables an Agent membership. A member
  with open assigned tickets cannot be disabled until those tickets are reassigned.
- `POST /api/v1/tickets/:ticketId/queue` places a ticket in an active queue and clears its assignee.
- `POST /api/v1/tickets/:ticketId/assign` manually assigns an active queue member.
- `POST /api/v1/tickets/:ticketId/unassign` retains the queue while clearing the assignee.
- `POST /api/v1/tickets/:ticketId/take-over` lets an Agent assign an accessible queue ticket to its
  own active membership.
- `POST /api/v1/tickets/:ticketId/round-robin` locks the queue cursor and deterministically selects
  the next active Agent member.
- `GET /api/v1/operations/dashboard` returns SQL-backed open, unassigned, own-ticket, queue, SLA
  approaching/breached totals, and at most 20 authorized warning rows. `GET /api/v1/operations/agent-workload` returns active-member workloads and
  accepts an optional `queueId`.

Every assignment write requires `expectedVersion` and advances the ticket revision. The current
queue/assignee projection, immutable assignment history, business audit entry, and versioned
`ticket.assignment-changed.v1` outbox message commit in one transaction. A queue-scoped row lock
serializes round-robin cursor changes. Composite foreign keys prevent cross-tenant queue,
membership, and ticket relationships; application policy additionally requires an active Agent
membership in the selected queue.

## SLA policy and ticket state

- `GET /api/v1/sla/policy` returns the active tenant's versioned wall-clock policy to roles with
  `sla.read`.
- `PUT /api/v1/sla/policy` creates or replaces all four priority targets and requires
  `expectedVersion`; only Owner and Manager have `sla.manage`.
- Staff ticket detail includes the immutable policy version, UTC first-response/resolution due
  instants, milestone states, completion evidence, and a resolved ticket's scheduled auto-close.

Every policy write requires exactly one `LOW`, `NORMAL`, `HIGH`, and `URGENT` target. Existing
ticket due instants never change when the policy is edited. Pending status does not pause a target.

## Notifications

- `GET /api/v1/notifications` returns the newest 20 notifications and unread count for the exact
  active `(tenant_id, membership_id)` pair.
- `POST /api/v1/notifications/:notificationId/read` marks one owned notification as read.
- `POST /api/v1/notifications/read-all` marks all unread notifications for the active membership as
  read.

Notification payloads are projected through an allowlist. Raw JSON stored by background consumers
is not returned directly, and a notification owned by another tenant or membership produces the
same non-disclosing `404` as an unknown identifier.

Known in-app kinds include automatic Agent assignment plus approaching and breached first-response
or resolution SLA warnings. SLA warnings are addressed to active Owner/Manager memberships and the
active assigned Agent, with recipient duplication removed.
