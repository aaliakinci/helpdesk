import { Injectable, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { connect, type ChannelModel } from "amqplib";

import { PlatformConfigService } from "../config/environment.js";
import { writeStructuredLog } from "../observability/json-logger.js";

@Injectable()
export class RabbitMqConnectionService implements OnModuleInit, BeforeApplicationShutdown {
  private connection: ChannelModel | undefined;
  private connectionPromise: Promise<ChannelModel> | undefined;

  public constructor(private readonly config: PlatformConfigService) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this.ensureConnected();
    } catch {
      writeStructuredLog("platform", "warn", "rabbitmq.connection.deferred");
    }
  }

  public async beforeApplicationShutdown(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.connectionPromise = undefined;
    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }

  public async ping(): Promise<void> {
    const connection = await this.ensureConnected();
    const channel = await connection.createChannel();
    await channel.close();
  }

  private async ensureConnected(): Promise<ChannelModel> {
    if (this.connection) {
      return this.connection;
    }

    this.connectionPromise ??= connect(this.config.values.rabbitMqUrl, {
      timeout: 2_000,
    });

    try {
      const connection = await this.connectionPromise;
      connection.on("close", () => {
        this.connection = undefined;
      });
      connection.on("error", () => undefined);
      this.connection = connection;
      return connection;
    } finally {
      this.connectionPromise = undefined;
    }
  }
}
