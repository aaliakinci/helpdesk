export { PlatformConfigService, parseEnvironment } from "./config/environment.js";
export { RabbitMqConnectionService } from "./connections/rabbitmq-connection.service.js";
export { RedisConnectionService } from "./connections/redis-connection.service.js";
export { PrismaService } from "./database/prisma.service.js";
export { HealthService } from "./health/health.service.js";
export type { HealthCheckResult, LivenessReport, ReadinessReport } from "./health/health.types.js";
export { registerShutdownHandlers } from "./lifecycle/shutdown.js";
export { JsonLogger, writeStructuredLog } from "./observability/json-logger.js";
export { RequestContextMiddleware } from "./observability/request-context.middleware.js";
export {
  RequestContextService,
  normalizeRequestId,
  resolveRequestIdentity,
} from "./observability/request-context.js";
export { PlatformModule } from "./platform.module.js";
