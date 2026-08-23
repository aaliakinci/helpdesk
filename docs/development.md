# Development guide

## Prerequisites

- Docker Engine with Docker Compose
- Node.js `24.19.0` and npm `11.17.0` for host-side commands

Copy the non-secret local template before starting services:

```bash
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL, RabbitMQ, Redis, applies pending Prisma migrations, then starts the API,
worker, and web services. Dependency health gates are explicit; an unmigrated database cannot make
the API or worker ready.

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
npm run test:integration
```

With the complete Compose topology running:

```bash
npm run smoke:services
```

`verify` is the static and build gate. The GitHub Actions workflow additionally applies migrations
to clean PostgreSQL and runs the infrastructure integration test.

## Service lifecycle

The API and worker enable NestJS shutdown hooks for `SIGINT` and `SIGTERM`. Shutdown closes the HTTP
listener before releasing Prisma, RabbitMQ, and Redis connections. Compose grants the processes a
bounded grace period.

Liveness indicates that the process can respond. Readiness checks the migrated PostgreSQL schema,
RabbitMQ channel creation, and Redis `PING`; failed checks return `503` from `/health/ready` without
terminating the process.
