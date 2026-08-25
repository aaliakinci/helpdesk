import { Module } from "@nestjs/common";

import { PlatformConfigService } from "./config/environment.js";
import { RabbitMqConnectionService } from "./connections/rabbitmq-connection.service.js";
import { RedisConnectionService } from "./connections/redis-connection.service.js";
import { SessionInvalidationService } from "./connections/session-invalidation.service.js";
import { PrismaService } from "./database/prisma.service.js";
import { HealthService } from "./health/health.service.js";
import { RequestContextMiddleware } from "./observability/request-context.middleware.js";
import { RequestContextService } from "./observability/request-context.js";
import { HttpRateLimitMiddleware } from "./security/http-rate-limit.middleware.js";
import { SecurityHeadersMiddleware } from "./security/security-headers.middleware.js";

const providers = [
  PlatformConfigService,
  PrismaService,
  RabbitMqConnectionService,
  RedisConnectionService,
  SessionInvalidationService,
  HealthService,
  RequestContextService,
  RequestContextMiddleware,
  HttpRateLimitMiddleware,
  SecurityHeadersMiddleware,
] as const;

@Module({
  providers: [...providers],
  exports: [...providers],
})
export class PlatformModule {}
