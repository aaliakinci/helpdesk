import { Module } from "@nestjs/common";

import { PlatformConfigService } from "./config/environment.js";
import { RabbitMqConnectionService } from "./connections/rabbitmq-connection.service.js";
import { RedisConnectionService } from "./connections/redis-connection.service.js";
import { PrismaService } from "./database/prisma.service.js";
import { HealthService } from "./health/health.service.js";
import { RequestContextMiddleware } from "./observability/request-context.middleware.js";
import { RequestContextService } from "./observability/request-context.js";

const providers = [
  PlatformConfigService,
  PrismaService,
  RabbitMqConnectionService,
  RedisConnectionService,
  HealthService,
  RequestContextService,
  RequestContextMiddleware,
] as const;

@Module({
  providers: [...providers],
  exports: [...providers],
})
export class PlatformModule {}
