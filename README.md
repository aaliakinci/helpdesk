# Helpdesk

A multi-tenant customer support platform for small and medium-sized support teams.

## Current foundation

- NestJS API and standalone worker composition roots
- Prisma 7 PostgreSQL client lifecycle and deployable migration
- PostgreSQL, RabbitMQ, and Redis readiness checks
- Liveness, readiness, public system status, and OpenAPI endpoints
- Structured JSON logs with request and correlation identifiers
- Central `application/problem+json` error responses
- Signed short-lived access tokens and rotating, hashed refresh sessions
- Server-derived tenant context with fixed Owner, Manager, Agent, Requester, and Auditor roles
- Same-tenant membership constraints and requester-to-customer-contact binding
- Customer/contact management with aggregate history and optimistic revisions
- Tenant-scoped ticket creation, pagination, role-projected details, public replies, and internal notes
- Fixed ticket state machine, first-response timestamp, optimistic concurrency, audit, and durable outbox
- Atomic per-tenant ticket numbering and linked reopen behavior for closed tickets
- React, Vite, and Lily UI login/session/ticket application with Turkish and English locales
- Docker Compose development topology and GitHub Actions quality gates

## Further v1 product scope

- Agent queues and round-robin assignment
- Outbox publishing and idempotent RabbitMQ consumers
- In-app notifications and authorized realtime updates
- Priority-based first-response and resolution SLA tracking
- Audit history, attachments, PostgreSQL search, and server-side pagination
- Docker-based local development and an HTTPS portfolio deployment

The v1 scope deliberately excludes email inbox synchronization, custom role builders, advanced business-hours calendars, Elasticsearch, AI features, billing, and omnichannel integrations.

## Architecture

The repository is organized around three deployable applications:

- `support-api`: NestJS modular-monolith HTTP API; authorized WebSocket support is planned
- `support-worker`: NestJS background process; durable consumers and scheduled jobs are planned
- `support-web`: React and TypeScript web application using `@lily_platform/lily_ui`

PostgreSQL is the source of truth. RabbitMQ delivery is at-least-once and consumers must be idempotent. Redis may support WebSocket scale-out and replaceable state, but business correctness must not depend on it.

See [the accepted architecture decisions](docs/decisions/README.md), [authentication design](docs/authentication.md), and [the platform baseline](docs/platform-baseline.md).

## Repository layout

```text
src/
├── server/
│   ├── apps/support-api/
│   ├── apps/support-worker/
│   ├── modules/
│   ├── platform/
│   └── prisma/
└── web/
tests/
├── unit/
├── integration/
├── contract/
└── e2e/
docs/
deploy/
scripts/
```

## Toolchain

- Node.js `24.19.0` LTS
- npm `11.17.0`
- NestJS `11.2.1` baseline
- Prisma ORM `7.9.1` baseline
- React `18.2.0`
- TypeScript `5.7.3`
- Vite `8.2.2`
- `@lily_platform/lily_ui` `0.1.0-alpha.2`

The host must satisfy the exact engine policy in `package.json`. The repository intentionally rejects unsupported Node.js versions.

## Security

Never commit `.env` files, access tokens, refresh tokens, private keys, or production credentials. `.env.example` contains placeholders only.

HTTP logs include method, path without query values, status, duration, request ID, and correlation ID.
They do not include request bodies, authorization headers, cookies, tokens, or connection URLs.

## Local development

Requirements: Docker Engine with Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

The local endpoints are:

- Web: <http://127.0.0.1:5173>
- API liveness: <http://127.0.0.1:8080/health/live>
- API readiness: <http://127.0.0.1:8080/health/ready>
- Public system status: <http://127.0.0.1:8080/api/v1/system/status>
- OpenAPI UI: <http://127.0.0.1:8080/openapi>
- Worker readiness: <http://127.0.0.1:8081/health/ready>
- RabbitMQ management: <http://127.0.0.1:15672>

After the containers are healthy, run `npm run smoke:services` from a Node.js 24.19.0
environment. `npm run smoke:identity` verifies login, tenant isolation, rotation/reuse detection,
role boundaries, requester binding, rate limiting, and tenant switching. Demo emails are documented
in [the authentication guide](docs/authentication.md); their local-only password is read from
`DEMO_SEED_PASSWORD`. `npm run smoke:support` verifies the primary requester and agent ticket flow,
including internal-note projection, lifecycle, stale revision handling, and linked reopen.

See [the development guide](docs/development.md) for the complete command matrix.

## License

This repository does not currently publish a license. Unless a license is added, all rights are reserved.
