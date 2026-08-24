import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { INestApplicationContext } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import type { Server, ServerOptions } from "socket.io";

import { PlatformConfigService, writeStructuredLog } from "../../../platform/index.js";

export class RedisIoAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | undefined;
  private publisher: RedisClientType | undefined;
  private subscriber: RedisClientType | undefined;

  public constructor(
    app: INestApplicationContext,
    private readonly config: PlatformConfigService,
  ) {
    super(app);
  }

  public async connectToRedis(): Promise<boolean> {
    const publisher = createClient({
      socket: {
        connectTimeout: 1_500,
        reconnectStrategy: (retries) => Math.min(2_000, 100 * 2 ** Math.min(retries, 4)),
      },
      url: this.config.values.redisUrl,
    });
    const subscriber = publisher.duplicate();
    publisher.on("error", () => undefined);
    subscriber.on("error", () => undefined);
    try {
      await withDeadline(Promise.all([publisher.connect(), subscriber.connect()]), 2_500);
      this.publisher = publisher;
      this.subscriber = subscriber;
      this.adapterFactory = createAdapter(publisher, subscriber, {
        key: "helpdesk.socket.io.v1",
        publishOnSpecificResponseChannel: true,
      });
      return true;
    } catch (error: unknown) {
      await closeRedisClient(publisher);
      await closeRedisClient(subscriber);
      writeStructuredLog("support-api", "warn", "realtime.redis_adapter.unavailable", {
        reason: error instanceof Error ? error.name : "UnknownError",
      });
      return false;
    }
  }

  public override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }

  public override async close(server: Parameters<IoAdapter["close"]>[0]): Promise<void> {
    await super.close(server);
    await Promise.all([closeRedisClient(this.publisher), closeRedisClient(this.subscriber)]);
    this.publisher = undefined;
    this.subscriber = undefined;
  }
}

async function withDeadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Redis connection timed out.")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeRedisClient(client: RedisClientType | undefined): Promise<void> {
  if (!client?.isOpen) return;
  try {
    await client.quit();
  } catch {
    client.destroy();
  }
}
