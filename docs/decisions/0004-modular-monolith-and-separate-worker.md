# ADR-0004: Modular monolith and separate worker

Status: Accepted

Date: 2026-08-23

## Context

Ticketing needs transactional consistency across ticket, history, audit, and outbox data, while background consumers and schedulers need independent process lifecycle and scaling.

## Decision

Use one repository and npm workspaces. The backend is a NestJS modular monolith with two deployable composition roots:

- `support-api` owns HTTP, OpenAPI, authentication adapters, and WebSocket delivery;
- `support-worker` owns outbox publication, RabbitMQ consumers, notification delivery, and scheduled jobs.

Business modules live under `src/server/modules`. Cross-cutting adapters live under `src/server/platform`. The API and worker import these modules in-process. No business module receives a separate network service or database in v1.

Within a feature, domain rules stay pure, application code owns use-case/transaction orchestration, infrastructure implements ports, and presentation adapts HTTP/WebSocket/message inputs. Generic repository and full CQRS/event-sourcing frameworks are not used.

## Consequences

API and worker can scale/restart separately without distributed business transactions. Module discipline must be protected because package count alone will not enforce boundaries.

## Verification

Lint/architecture rules protect dependency direction; process smoke tests protect independent startup, readiness, and graceful shutdown.

## Revisit when

A measured scaling, failure-isolation, ownership, or deployment requirement cannot be solved by independent API/worker processes and modular code.
