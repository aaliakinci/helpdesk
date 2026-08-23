import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PlatformConfigService } from "../../src/server/platform/config/environment.js";
import { RabbitMqConnectionService } from "../../src/server/platform/connections/rabbitmq-connection.service.js";
import { RedisConnectionService } from "../../src/server/platform/connections/redis-connection.service.js";
import { PrismaService } from "../../src/server/platform/database/prisma.service.js";
import { HealthService } from "../../src/server/platform/health/health.service.js";

describe("infrastructure readiness", () => {
  const config = new PlatformConfigService();
  const prisma = new PrismaService(config);
  const rabbitMq = new RabbitMqConnectionService(config);
  const redis = new RedisConnectionService(config);
  const health = new HealthService(config, prisma, rabbitMq, redis);

  beforeAll(async () => {
    await Promise.all([prisma.onModuleInit(), rabbitMq.onModuleInit(), redis.onModuleInit()]);
  });

  afterAll(async () => {
    await Promise.all([
      prisma.beforeApplicationShutdown(),
      rabbitMq.beforeApplicationShutdown(),
      redis.beforeApplicationShutdown(),
    ]);
  });

  it("reports PostgreSQL, RabbitMQ, and Redis as ready", async () => {
    const report = await health.readiness("integration-test", "trace-integration");

    expect(report.status).toBe("ready");
    expect(report.checks).toMatchObject({
      postgresql: { status: "up" },
      rabbitmq: { status: "up" },
      redis: { status: "up" },
    });
  });
});
