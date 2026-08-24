import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";

import { writeStructuredLog } from "./json-logger.js";
import { RequestContextService, resolveRequestIdentity } from "./request-context.js";

interface HttpRequest {
  readonly headers: IncomingHttpHeaders;
  readonly method: string;
  readonly originalUrl: string;
}

interface HttpResponse {
  readonly statusCode: number;
  once(event: "finish", listener: () => void): this;
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public constructor(private readonly requestContext: RequestContextService) {}

  public use(request: HttpRequest, response: HttpResponse, next: () => void): void {
    const identity = resolveRequestIdentity(request.headers);
    const startedAt = performance.now();

    response.setHeader("x-request-id", identity.traceId);
    response.setHeader("x-correlation-id", identity.correlationId);
    response.setHeader("traceparent", identity.traceparent);
    response.once("finish", () => {
      writeStructuredLog("support-api", "info", "http.request.completed", {
        correlationId: identity.correlationId,
        durationMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
        method: request.method,
        path: stripQuery(request.originalUrl),
        statusCode: response.statusCode,
        traceId: identity.traceId,
        traceparent: identity.traceparent,
      });
    });

    this.requestContext.run(identity.traceId, identity.correlationId, next, identity.traceparent);
  }
}

function stripQuery(url: string): string {
  return url.split("?", 1)[0] ?? "/";
}
