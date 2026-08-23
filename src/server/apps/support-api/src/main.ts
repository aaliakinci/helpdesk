import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import {
  JsonLogger,
  PlatformConfigService,
  RequestContextService,
  registerShutdownHandlers,
  writeStructuredLog,
} from "../../../platform/index.js";
import { AppModule } from "./app.module.js";
import { ProblemDetailsFilter } from "./problem-details.filter.js";

async function bootstrap(): Promise<void> {
  const logger = new JsonLogger("support-api");
  const app = await NestFactory.create(AppModule, {
    logger,
  });
  const config = app.get(PlatformConfigService);

  app.enableCors({
    credentials: true,
    allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Correlation-ID", "X-Request-ID"],
    methods: ["GET", "HEAD", "OPTIONS", "PATCH", "POST"],
    origin: config.values.webOrigin,
  });
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(RequestContextService)));

  const openApiConfig = new DocumentBuilder()
    .setTitle("Helpdesk Support API")
    .setDescription("Public system contracts and versioned helpdesk APIs.")
    .setVersion(config.values.appVersion)
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("openapi", app, document, {
    jsonDocumentUrl: "openapi.json",
  });

  await app.listen(config.values.apiPort, "0.0.0.0");
  registerShutdownHandlers(app, "support-api");
  writeStructuredLog("support-api", "info", "service.started", {
    port: config.values.apiPort,
    version: config.values.appVersion,
  });
}

void bootstrap().catch((error: unknown) => {
  writeStructuredLog("support-api", "error", "service.start_failed", {
    reason: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
