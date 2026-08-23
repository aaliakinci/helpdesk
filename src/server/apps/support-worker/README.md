# support-worker

NestJS composition root for outbox publication, RabbitMQ consumers, notification delivery, scheduled jobs, and worker health/readiness.

The worker invokes shared server-module use cases and preserves idempotency, retry, dead-letter, trace propagation, and graceful-shutdown guarantees.
