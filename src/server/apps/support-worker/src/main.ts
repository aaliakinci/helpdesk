import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import {
  JsonLogger,
  registerShutdownHandlers,
  writeStructuredLog,
} from "../../../platform/index.js";
import { WorkerModule } from "./worker.module.js";

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(WorkerModule, {
    logger: new JsonLogger("support-worker"),
  });
  registerShutdownHandlers(context, "support-worker");
}

void bootstrap().catch((error: unknown) => {
  writeStructuredLog("support-worker", "error", "service.start_failed", {
    reason: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
