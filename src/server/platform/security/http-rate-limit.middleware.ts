import { Injectable, type NestMiddleware } from "@nestjs/common";

import { PlatformConfigService } from "../config/environment.js";
import { RequestContextService } from "../observability/request-context.js";
import { BoundedRateLimiter } from "./bounded-rate-limiter.js";

interface HttpRequest {
  readonly ip?: string;
  readonly method: string;
  readonly originalUrl: string;
  readonly socket?: { readonly remoteAddress?: string };
}

interface HttpResponse {
  end(body?: string): void;
  setHeader(name: string, value: string): void;
  statusCode: number;
}

@Injectable()
export class HttpRateLimitMiddleware implements NestMiddleware {
  private readonly limiter = new BoundedRateLimiter();

  public constructor(
    private readonly config: PlatformConfigService,
    private readonly requestContext: RequestContextService,
  ) {}

  public use(request: HttpRequest, response: HttpResponse, next: () => void): void {
    if (request.method === "OPTIONS") {
      next();
      return;
    }
    const upload =
      request.method === "POST" &&
      /^\/api\/v1\/tickets\/[^/]+\/attachments(?:\?|$)/u.test(request.originalUrl);
    const limit = upload ? this.config.values.uploadRateLimit : this.config.values.requestRateLimit;
    const windowSeconds = this.config.values.requestRateWindowSeconds;
    const key = `${upload ? "upload" : "http"}:${request.ip ?? request.socket?.remoteAddress ?? "unknown"}`;
    const decision = this.limiter.consume(key, limit, windowSeconds * 1_000);
    response.setHeader("RateLimit-Limit", String(limit));
    response.setHeader("RateLimit-Remaining", String(decision.remaining));
    response.setHeader("RateLimit-Reset", String(Math.ceil(decision.resetAt / 1_000)));
    if (decision.allowed) {
      next();
      return;
    }
    const traceId = this.requestContext.traceId ?? "unavailable";
    response.statusCode = 429;
    response.setHeader("Content-Type", "application/problem+json");
    response.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1_000))),
    );
    response.end(
      JSON.stringify({
        code: "request.rate_limited",
        detail: "Too many requests were made. Try again later.",
        instance: request.originalUrl.split("?", 1)[0] ?? "/",
        status: 429,
        title: "Too many requests",
        traceId,
        type: "https://helpdesk.example/problems/request.rate_limited",
      }),
    );
  }
}
