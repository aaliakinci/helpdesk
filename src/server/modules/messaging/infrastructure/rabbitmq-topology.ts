import type { Channel } from "amqplib";

import { RETRY_DELAYS_MS } from "../domain/retry-policy.js";

export const RABBIT_TOPOLOGY = {
  deadLetterExchange: "helpdesk.dlx.v1",
  deadLetterQueue: "helpdesk.worker.dlq.v1",
  eventExchange: "helpdesk.events.v1",
  mainQueue: "helpdesk.worker.v1",
  realtimeQueue: "helpdesk.realtime.v1",
  realtimeRetryExchange: "helpdesk.realtime.retry.v1",
  realtimeRetryQueues: RETRY_DELAYS_MS.map((delay) => ({
    delay,
    queue: `helpdesk.realtime.retry.${delay}.v1`,
    routingKey: `realtime.retry.${delay}`,
  })),
  realtimeReturnExchange: "helpdesk.realtime.return.v1",
  realtimeDeadLetterQueue: "helpdesk.realtime.dlq.v1",
  retryExchange: "helpdesk.retry.v1",
  retryQueues: RETRY_DELAYS_MS.map((delay) => ({
    delay,
    queue: `helpdesk.worker.retry.${delay}.v1`,
    routingKey: `retry.${delay}`,
  })),
} as const;

export async function assertMessagingTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(RABBIT_TOPOLOGY.eventExchange, "topic", { durable: true });
  await channel.assertExchange(RABBIT_TOPOLOGY.retryExchange, "direct", { durable: true });
  await channel.assertExchange(RABBIT_TOPOLOGY.realtimeRetryExchange, "direct", { durable: true });
  await channel.assertExchange(RABBIT_TOPOLOGY.realtimeReturnExchange, "direct", { durable: true });
  await channel.assertExchange(RABBIT_TOPOLOGY.deadLetterExchange, "direct", { durable: true });
  await channel.assertQueue(RABBIT_TOPOLOGY.mainQueue, { durable: true });
  await channel.bindQueue(RABBIT_TOPOLOGY.mainQueue, RABBIT_TOPOLOGY.eventExchange, "#");
  await channel.assertQueue(RABBIT_TOPOLOGY.realtimeQueue, { durable: true });
  await channel.bindQueue(RABBIT_TOPOLOGY.realtimeQueue, RABBIT_TOPOLOGY.eventExchange, "#");
  await channel.bindQueue(
    RABBIT_TOPOLOGY.realtimeQueue,
    RABBIT_TOPOLOGY.realtimeReturnExchange,
    "return",
  );

  for (const retry of RABBIT_TOPOLOGY.realtimeRetryQueues) {
    await channel.assertQueue(retry.queue, {
      arguments: {
        "x-dead-letter-exchange": RABBIT_TOPOLOGY.realtimeReturnExchange,
        "x-dead-letter-routing-key": "return",
        "x-message-ttl": retry.delay,
      },
      durable: true,
    });
    await channel.bindQueue(retry.queue, RABBIT_TOPOLOGY.realtimeRetryExchange, retry.routingKey);
  }

  for (const retry of RABBIT_TOPOLOGY.retryQueues) {
    await channel.assertQueue(retry.queue, {
      arguments: {
        "x-dead-letter-exchange": RABBIT_TOPOLOGY.eventExchange,
        "x-dead-letter-routing-key": "retry.return",
        "x-message-ttl": retry.delay,
      },
      durable: true,
    });
    await channel.bindQueue(retry.queue, RABBIT_TOPOLOGY.retryExchange, retry.routingKey);
  }

  await channel.assertQueue(RABBIT_TOPOLOGY.deadLetterQueue, { durable: true });
  await channel.bindQueue(
    RABBIT_TOPOLOGY.deadLetterQueue,
    RABBIT_TOPOLOGY.deadLetterExchange,
    "dead",
  );
  await channel.assertQueue(RABBIT_TOPOLOGY.realtimeDeadLetterQueue, { durable: true });
  await channel.bindQueue(
    RABBIT_TOPOLOGY.realtimeDeadLetterQueue,
    RABBIT_TOPOLOGY.deadLetterExchange,
    "realtime.dead",
  );
}
