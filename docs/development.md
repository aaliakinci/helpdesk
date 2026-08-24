# Development guide

## Prerequisites

- Docker Engine with Docker Compose
- Node.js `24.19.0` and npm `11.17.0` for host-side commands

Copy the non-secret local template before starting services:

```bash
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL, RabbitMQ, Redis, applies pending Prisma migrations, seeds deterministic
local identities, then starts the API, worker, and web services. Dependency health gates are
explicit; an unmigrated or unseeded database cannot start the API.

Stop the topology without deleting data volumes:

```bash
docker compose down
```

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run verify
```

Run the real infrastructure integration test with PostgreSQL, RabbitMQ, and Redis available at the
URLs in the environment:

```bash
npm run db:migrate:deploy
npm run build:server
npm run db:seed
npm run test:integration
```

With the complete Compose topology running:

```bash
npm run smoke:services
npm run smoke:identity
npm run smoke:support
npm run smoke:operations
```

The identity and support smoke commands require `DEMO_SEED_PASSWORD` and use the running API; they
never print the password, access token, or refresh cookie. The support smoke covers requester
creation/reply, staff public/internal replies, status transitions, stale revisions, linked reopen,
role boundaries, and cross-tenant reads. The operations smoke covers queue membership, manual and
round-robin assignment, Agent take-over, assignment history, dashboard/workload, and tenant
isolation. `verify` is the static and build gate. The GitHub Actions
workflow additionally applies migrations, seeds deterministic test identities, and runs the real
infrastructure integration suite serially because all files share one qualified database.

## Service lifecycle

The API and worker enable NestJS shutdown hooks for `SIGINT` and `SIGTERM`. Shutdown closes the HTTP
listener before releasing Prisma, RabbitMQ, and Redis connections. Compose grants the processes a
bounded grace period.

Liveness indicates that the process can respond. Readiness checks the migrated PostgreSQL schema,
RabbitMQ channel creation, and Redis `PING`; failed checks return `503` from `/health/ready` without
terminating the process.
