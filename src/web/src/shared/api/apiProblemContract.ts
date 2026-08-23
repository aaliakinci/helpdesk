import { LilyApiError } from "@lily_platform/lily_ui/errors";
import type { LilyApiErrorMapperContext } from "@lily_platform/lily_ui/http";

export interface ApiProblemDetails {
  readonly code: string;
  readonly detail: string;
  readonly instance: string;
  readonly status: number;
  readonly title: string;
  readonly traceId: string;
  readonly type: string;
}

export function decodeApiProblemDetails(body: unknown): ApiProblemDetails | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const stringFields = ["code", "detail", "instance", "title", "traceId", "type"] as const;
  if (
    !Number.isInteger(candidate.status) ||
    stringFields.some(
      (field) => typeof candidate[field] !== "string" || candidate[field].length === 0,
    )
  ) {
    return null;
  }

  return candidate as unknown as ApiProblemDetails;
}

export function mapApiProblemError(context: LilyApiErrorMapperContext): LilyApiError {
  const problem = decodeApiProblemDetails(context.body);
  return new LilyApiError({
    code: problem?.code ?? "common.http_error",
    message: problem?.detail ?? `Request failed with status ${context.status}.`,
    details: context.body,
    statusCode: context.status,
    ...(problem?.traceId || context.requestId
      ? { traceId: problem?.traceId ?? context.requestId }
      : {}),
  });
}
