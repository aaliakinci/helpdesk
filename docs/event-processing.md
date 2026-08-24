# Event processing

The support API writes the domain change, audit entry, and outbox record in one PostgreSQL transaction. The support worker leases pending outbox records with `FOR UPDATE SKIP LOCKED`, publishes a versioned envelope to RabbitMQ, waits for publisher confirmation, and only then marks the record as published.

This is an at-least-once pipeline. A worker can stop after RabbitMQ confirms a publish but before PostgreSQL records it. The lease then expires and the same `messageId` can be published again. Consumers therefore record `(consumer_name, message_id)` in `consumed_messages` in the same transaction as their database side effect.

## Event envelope

Every message is JSON and is validated at the worker boundary:

```json
{
  "messageId": "UUID",
  "type": "ticket.created.v1",
  "schemaVersion": 1,
  "occurredAtUtc": "2026-08-24T15:00:00.000Z",
  "tenantId": "UUID",
  "aggregateId": "UUID",
  "correlationId": "optional request correlation",
  "causationId": "optional causing operation",
  "traceparent": "00-...-...-01",
  "payload": {}
}
```

The API accepts a valid W3C `traceparent` header or creates one. The same value is stored in the outbox, sent as message metadata, restored in worker request context, and included with message identifiers in structured logs.

## RabbitMQ topology and failure handling

The worker declares durable infrastructure on startup:

- topic exchange: `helpdesk.events.v1`
- consumer queue: `helpdesk.worker.v1`
- retry exchange: `helpdesk.retry.v1`
- retry queues: 1 second, 5 seconds, and 30 seconds
- dead-letter exchange: `helpdesk.dlx.v1`
- dead-letter queue: `helpdesk.worker.dlq.v1`

Deliveries use manual acknowledgements. Successful work is acknowledged after its transaction commits. A failed delivery is published to a bounded retry queue and the original is acknowledged only after RabbitMQ confirms that transfer. After `MESSAGING_MAX_ATTEMPTS`, it is confirmed into the dead-letter queue. If the transfer itself fails, the original delivery is negatively acknowledged and requeued.

On shutdown the worker cancels new deliveries, waits for in-flight handlers to finish their ack/nack decision, closes its channels, and then closes the shared connection.

## Ticket creation consumers

`ticket.created.v1` is processed by independent idempotent consumers:

1. Automatic assignment selects the first active queue by name and ID that has an active Agent member. It serializes that queue's cursor and assigns the next member in stable membership-ID order.
2. In-app delivery creates one notification for the assigned membership and a delivered in-app delivery record.
3. The local demo email adapter receives the notification delivery's stable deduplication key and marks the email delivery as delivered.

Assignment is eventual: the ticket transaction succeeds without RabbitMQ being available. Until the worker completes, the ticket remains visible and unassigned. If no eligible queue exists, processing retries and ultimately becomes visible in the DLQ.

The included email provider is deliberately local and logs only operational identifiers. A production provider adapter must accept the supplied deduplication key and must not log recipient addresses or message content.

## DLQ inspection and replay

Use the RabbitMQ management UI at `http://127.0.0.1:15672` in local development and inspect `helpdesk.worker.dlq.v1`. Review the `message_id`, event `type`, `traceparent`, `x-helpdesk-attempt`, and `x-helpdesk-error` headers together with worker logs before replaying.

Replay the original body to `helpdesk.events.v1` with its original routing key, `message_id`, and trace headers. Reset `x-helpdesk-attempt` to `0`. Do not delete `consumed_messages` during ordinary replay: already committed consumers will skip the duplicate, while an incomplete consumer will run. Deliberately rerunning a completed side effect requires an approved data repair because notification and delivery uniqueness constraints also protect against duplication.

RabbitMQ's management UI can move or republish individual messages. For controlled production operations, use a reviewed script or shovel that preserves message properties, confirm the republish, and only then acknowledge the DLQ copy.
