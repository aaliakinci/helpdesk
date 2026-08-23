import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from "@nestjs/common";

import { RequestContextService, writeStructuredLog } from "../../../platform/index.js";

interface HttpRequest {
  readonly originalUrl: string;
}

interface HttpResponse {
  send(body: unknown): void;
  status(statusCode: number): this;
  type(contentType: string): this;
}

interface ProblemDetails {
  readonly code: string;
  readonly detail: string;
  readonly instance: string;
  readonly status: number;
  readonly title: string;
  readonly traceId: string;
  readonly type: string;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  public constructor(private readonly requestContext: RequestContextService) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<HttpRequest>();
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const traceId = this.requestContext.traceId ?? "unavailable";
    const problem = createProblemDetails(status, stripQuery(request.originalUrl), traceId);

    if (status >= 500) {
      writeStructuredLog("support-api", "error", "http.request.failed", {
        code: problem.code,
        path: problem.instance,
        statusCode: status,
        traceId,
      });
    }

    response.status(status).type("application/problem+json").send(problem);
  }
}

export function createProblemDetails(
  status: number,
  instance: string,
  traceId: string,
): ProblemDetails {
  const definition = problemDefinition(status);
  return {
    code: definition.code,
    detail: definition.detail,
    instance,
    status,
    title: definition.title,
    traceId,
    type: `https://helpdesk.example/problems/${definition.code}`,
  };
}

function problemDefinition(status: number): {
  readonly code: string;
  readonly detail: string;
  readonly title: string;
} {
  switch (status) {
    case 400:
      return {
        code: "request.invalid",
        detail: "The request could not be processed.",
        title: "Invalid request",
      };
    case 401:
      return {
        code: "auth.required",
        detail: "Authentication is required.",
        title: "Authentication required",
      };
    case 403:
      return {
        code: "auth.forbidden",
        detail: "The operation is not permitted.",
        title: "Forbidden",
      };
    case 404:
      return {
        code: "resource.not_found",
        detail: "The requested resource was not found.",
        title: "Not found",
      };
    case 503:
      return {
        code: "service.not_ready",
        detail: "The service is not ready to accept this operation.",
        title: "Service unavailable",
      };
    default:
      return {
        code: status >= 500 ? "internal.unexpected" : "request.rejected",
        detail:
          status >= 500 ? "An unexpected error occurred." : "The request could not be completed.",
        title: status >= 500 ? "Internal server error" : "Request rejected",
      };
  }
}

function stripQuery(url: string): string {
  return url.split("?", 1)[0] ?? "/";
}
