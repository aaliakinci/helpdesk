import { Injectable, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

import { PlatformConfigService } from "../config/environment.js";
import { writeStructuredLog } from "../observability/json-logger.js";

@Injectable()
export class RedisConnectionService implements OnModuleInit, BeforeApplicationShutdown {
  private client: RedisClientType | undefined;
  private connectionPromise: Promise<void> | undefined;

  public constructor(private readonly config: PlatformConfigService) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.ensureConnected();
    } catch {
      writeStructuredLog("platform", "warn", "redis.connection.deferred");
    }
  }

  public async beforeApplicationShutdown(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    this.connectionPromise = undefined;

    if (!client?.isOpen) {
      return;
    }

    try {
      await client.quit();
    } catch {
      client.destroy();
    }
  }

  public async ping(): Promise<void> {
    await this.ensureConnected();
    const result = await this.client?.ping();
    if (result !== "PONG") {
      throw new Error("Redis readiness probe failed.");
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.client?.isReady) {
      return;
    }

    if (!this.client || !this.client.isOpen) {
      this.client = createClient({
        url: this.config.values.redisUrl,
        socket: {
          connectTimeout: 2_000,
          reconnectStrategy: false,
        },
      });
      this.client.on("error", () => undefined);
    }

    this.connectionPromise ??= this.client
      .connect()
      .then(() => undefined)
      .finally(() => {
        this.connectionPromise = undefined;
      });
    await this.connectionPromise;
  }
}
