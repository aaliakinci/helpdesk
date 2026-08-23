# Platform baseline

Qualification date: 23 August 2026

Status: Accepted application baseline

## Runtime and framework baseline

| Concern           | Selected baseline | Evidence/decision                                         |
| ----------------- | ----------------: | --------------------------------------------------------- |
| Node.js           |         `24.19.0` | Current LTS line; official container qualification passed |
| npm               |         `11.17.0` | Bundled by the selected official Node image               |
| NestJS            |          `11.2.1` | Current npm release; Node.js 20+ requirement              |
| Prisma ORM/Client |           `7.9.1` | Current generally available release; Node 24 supported    |
| TypeScript        |           `5.7.3` | Qualified Lily UI baseline                                |
| React/React DOM   |          `18.2.0` | Qualified Lily UI baseline                                |
| Vite              |           `8.2.2` | Qualified with Node 24 and Lily UI                        |
| Lily UI           |   `0.1.0-alpha.2` | Exact pre-1.0 pin; production build qualification passed  |

Prisma 8 is release-candidate software at the qualification date and is not selected. Prisma 7 direct PostgreSQL connections require the official PostgreSQL driver adapter; applications must use matching `prisma`, `@prisma/client`, and `@prisma/adapter-pg` versions.

## Service image baseline

Images were pulled from Docker Official Images and their multi-platform manifest digests were recorded.

| Service    | Development tag              | Qualified manifest digest                                                 |
| ---------- | ---------------------------- | ------------------------------------------------------------------------- |
| Node.js    | `node:24.19.0-bookworm-slim` | `sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03` |
| PostgreSQL | `postgres:18.6-bookworm`     | `sha256:7d2695c3aa88e792e8b3b233e7e4adb296a20412c6c0ca361e3edaaacfada108` |
| RabbitMQ   | `rabbitmq:4.3.4-management`  | `sha256:eb5295d083325da5929a5ade766684d4019ffd2bce8bc7e43d6f9a05cafc8646` |
| Redis      | `redis:8.2.8-bookworm`       | `sha256:2f7462b9e93e0a7ae2edf3a0a0babc8a4d29f8bfc50849b906b7caaef925edc1` |

RabbitMQ `4.3.5` was the latest upstream patch on the qualification date, while `4.3.4-management` was the latest verified Docker Official Image tag. The image baseline should move to `4.3.5-management` only after that official tag is available and the health/queue compatibility smoke passes.

Redis `8.2` was selected instead of the newest feature line because it has a published support horizon through September 2030 and is sufficient for the project's replaceable cache/Socket.IO adapter use cases. Redis 8 licensing must remain visible in dependency and deployment review.

## Local qualification results

- Docker Engine: `29.7.2`
- Docker Compose: `5.5.0`
- Lily UI clean install: 211 packages, 0 reported vulnerabilities
- TypeScript + Vite production build: successful
- Build transform count: 914 modules
- JavaScript output: 258.93 kB, 85.48 kB gzip

The qualification project was temporary and is not part of this repository.

## Upgrade rule

Direct dependencies use exact versions and the root lockfile is authoritative. Framework, database, broker, cache, or Lily UI upgrades require a dedicated compatibility change with the same type-check, build, integration, container, and browser gates that protect the affected boundary.

## Primary references

- <https://nodejs.org/en/about/previous-releases>
- <https://docs.nestjs.com/migration-guide>
- <https://docs.prisma.io/docs/orm/reference/system-requirements>
- <https://www.prisma.io/docs/orm>
- <https://www.postgresql.org/support/versioning/>
- <https://www.rabbitmq.com/release-information>
- <https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/>
- <https://hub.docker.com/_/postgres>
- <https://hub.docker.com/_/rabbitmq>
- <https://hub.docker.com/_/redis>
