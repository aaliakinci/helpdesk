import { Injectable } from "@nestjs/common";

import { PlatformConfigService } from "../config/environment.js";
import { RabbitMqConnectionService } from "../connections/rabbitmq-connection.service.js";
import { RedisConnectionService } from "../connections/redis-connection.service.js";
import { PrismaService } from "../database/prisma.service.js";
import type { HealthCheckResult, LivenessReport, ReadinessReport } from "./health.types.js";

@Injectable()
export class HealthService {
  public constructor(
    private readonly config: PlatformConfigService,
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqConnectionService,
    private readonly redis: RedisConnectionService,
  ) {}

  public liveness(service: string, traceId: string): LivenessReport {
    return {
      service,
      status: "alive",
      timestamp: new Date().toISOString(),
      traceId,
      version: this.config.values.appVersion,
    };
  }

  public async readiness(service: string, traceId: string): Promise<ReadinessReport> {
    const [postgresql, rabbitmq, redis] = await Promise.all([
      runCheck(() => this.prisma.ping()),
      runCheck(() => this.rabbitMq.ping()),
      runCheck(() => this.redis.ping()),
    ]);
    const checks = { postgresql, rabbitmq, redis } as const;

    return {
      checks,
      service,
      status: Object.values(checks).every((check) => check.status === "up") ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      traceId,
      version: this.config.values.appVersion,
    };
  }
}

async function runCheck(probe: () => Promise<void>): Promise<HealthCheckResult> {
  const startedAt = performance.now();
  try {
    await probe();
    return {
      durationMilliseconds: elapsedMilliseconds(startedAt),
      status: "up",
    };
  } catch {
    return {
      durationMilliseconds: elapsedMilliseconds(startedAt),
      status: "down",
    };
  }
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
