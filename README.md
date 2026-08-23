# Helpdesk

A multi-tenant customer support platform for small and medium-sized support teams.

## Product scope

- Customer and requester ticket creation
- Agent queues and round-robin assignment
- Public replies and private internal notes
- Ticket lifecycle and history
- Transactional outbox and idempotent RabbitMQ consumers
- In-app notifications and authorized realtime updates
- Priority-based first-response and resolution SLA tracking
- Audit history, attachments, PostgreSQL search, and server-side pagination
- Docker-based local development and an HTTPS portfolio deployment

The v1 scope deliberately excludes email inbox synchronization, custom role builders, advanced business-hours calendars, Elasticsearch, AI features, billing, and omnichannel integrations.

## Architecture

The repository is organized around three deployable applications:

- `support-api`: NestJS modular-monolith HTTP and WebSocket API
- `support-worker`: NestJS background worker for outbox publication, RabbitMQ consumers, notification delivery, and scheduled jobs
- `support-web`: React and TypeScript web application using `@lily_platform/lily_ui`

PostgreSQL is the source of truth. RabbitMQ delivery is at-least-once and consumers must be idempotent. Redis may support WebSocket scale-out and replaceable state, but business correctness must not depend on it.

See [the accepted architecture decisions](docs/decisions/README.md) and [the platform baseline](docs/platform-baseline.md).

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

## License

This repository does not currently publish a license. Unless a license is added, all rights are reserved.
