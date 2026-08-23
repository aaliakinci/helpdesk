# ADR-0005: Transactional outbox and at-least-once delivery

Status: Accepted

Date: 2026-08-23

## Context

Publishing to RabbitMQ inside a database transaction cannot atomically commit both systems. Publishing before commit risks events for rolled-back data; publishing after commit without durability risks missing events.

## Decision

Every business write that requires asynchronous work writes a versioned outbox message in the same PostgreSQL transaction as the aggregate, history, and audit changes. A worker publisher leases pending rows, publishes with RabbitMQ publisher confirms, and marks them published.

The boundary is explicitly at-least-once: a crash after broker confirmation but before database marking may republish. Every consumer therefore records `(consumer_name, message_id)` under a unique constraint in the same transaction as its side effect. Retries are bounded and poison messages end in a visible dead-letter queue.

Event envelopes carry message ID, type, schema version, occurred time, tenant ID, aggregate ID, correlation ID, and causation ID. Payloads avoid unnecessary personal data.

## Consequences

Duplicate delivery is normal and harmless when consumers comply. Outbox lag, retry count, and DLQ depth become operational signals.

## Verification

Integration tests force duplicate delivery, publish/mark crash windows, consumer rollback, retry exhaustion, DLQ routing, and graceful shutdown against real PostgreSQL and RabbitMQ.

## Revisit when

The selected broker/database offers a proven atomic mechanism that materially simplifies the design without weakening durability or portability.
