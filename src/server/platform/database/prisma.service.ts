import { Injectable, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { PlatformConfigService } from "../config/environment.js";
import { writeStructuredLog } from "../observability/json-logger.js";
import { PrismaClient } from "./generated/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, BeforeApplicationShutdown {
  public constructor(config: PlatformConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.values.databaseUrl,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      max: 10,
    });
    super({ adapter });
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch {
      writeStructuredLog("platform", "warn", "postgresql.connection.deferred");
    }
  }

  public async beforeApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }

  public async ping(): Promise<void> {
    await this.platformMetadata.count();
  }
}
