# support-worker

NestJS standalone composition root with infrastructure readiness and graceful shutdown management.

The process owns durable outbox publication, idempotent RabbitMQ consumers, retry/dead-letter
handling, notification delivery, bounded SLA scans, and resolved-ticket auto-close scheduling.
Scheduler shutdown waits for the active PostgreSQL transaction before the shared database lifecycle
is closed.
