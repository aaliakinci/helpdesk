import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  HealthService,
  PlatformConfigService,
  resolveRequestIdentity,
  writeStructuredLog,
} from "../../../platform/index.js";

@Injectable()
export class WorkerHealthServer implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private server: Server | undefined;

  public constructor(
    private readonly config: PlatformConfigService,
    private readonly health: HealthService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handle(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.config.values.workerHealthPort, "0.0.0.0", () => resolve());
    });
    writeStructuredLog("support-worker", "info", "service.started", {
      port: this.config.values.workerHealthPort,
      version: this.config.values.appVersion,
    });
  }

  public async beforeApplicationShutdown(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections();
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const identity = resolveRequestIdentity(request.headers);
    response.setHeader("cache-control", "no-store");
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("x-correlation-id", identity.correlationId);
    response.setHeader("x-request-id", identity.traceId);

    if (request.method === "GET" && request.url === "/health/live") {
      this.send(response, 200, this.health.liveness("support-worker", identity.traceId));
      return;
    }

    if (request.method === "GET" && request.url === "/health/ready") {
      const report = await this.health.readiness("support-worker", identity.traceId);
      this.send(response, report.status === "ready" ? 200 : 503, report);
      return;
    }

    response.setHeader("content-type", "application/problem+json; charset=utf-8");
    this.send(response, 404, {
      code: "resource.not_found",
      detail: "The requested resource was not found.",
      instance: request.url?.split("?", 1)[0] ?? "/",
      status: 404,
      title: "Not found",
      traceId: identity.traceId,
      type: "https://helpdesk.example/problems/resource.not_found",
    });
  }

  private send(response: ServerResponse, statusCode: number, body: unknown): void {
    response.statusCode = statusCode;
    response.end(JSON.stringify(body));
  }
}
