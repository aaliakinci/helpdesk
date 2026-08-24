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

- `GET /api/v1/tickets` supports bounded `page`, `pageSize`, `status`, `priority`, `sortBy`, and
  `sortDirection` parameters.
- `POST /api/v1/tickets` creates a ticket, initial status history, audit entry, and
  `ticket.created.v1` outbox message in one transaction.
- `GET /api/v1/tickets/:ticketId` applies role-specific projection. Requesters can read only tickets
  attached to their server-derived customer contact and never receive internal comments.
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
