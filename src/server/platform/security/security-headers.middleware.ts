import { Injectable, type NestMiddleware } from "@nestjs/common";

import { PlatformConfigService } from "../config/environment.js";

interface HttpResponse {
  setHeader(name: string, value: string): void;
}

interface HttpRequest {
  readonly originalUrl?: string;
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  public constructor(private readonly config: PlatformConfigService) {}

  public use(request: HttpRequest, response: HttpResponse, next: () => void): void {
    const isOpenApiUi =
      request.originalUrl === "/openapi" || request.originalUrl?.startsWith("/openapi/");
    response.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; base-uri 'self'; connect-src 'self' ws: wss:; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'${isOpenApiUi ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'`,
    );
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    if (this.config.values.nodeEnvironment === "production") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  }
}
