import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes, randomUUID } from "node:crypto";

interface RequestContextState {
  readonly correlationId: string;
  readonly traceId: string;
  readonly traceparent: string;
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  public get correlationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }

  public get traceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }

  public get traceparent(): string | undefined {
    return this.storage.getStore()?.traceparent;
  }

  public run<T>(
    traceId: string,
    correlationId: string,
    callback: () => T,
    traceparent = createTraceparent(),
  ): T {
    return this.storage.run({ traceId, correlationId, traceparent }, callback);
  }
}

export function resolveRequestIdentity(headers: Readonly<Record<string, unknown>>): {
  readonly correlationId: string;
  readonly traceId: string;
  readonly traceparent: string;
} {
  const traceId = normalizeRequestId(headers["x-request-id"]) ?? randomUUID();
  const correlationId = normalizeRequestId(headers["x-correlation-id"]) ?? traceId;
  const traceparent = normalizeTraceparent(headers.traceparent) ?? createTraceparent();
  return { traceId, correlationId, traceparent };
}

export function normalizeRequestId(value: unknown): string | undefined {
  const candidate: unknown = Array.isArray(value) ? (value as unknown[]).at(0) : value;
  return typeof candidate === "string" && SAFE_REQUEST_ID.test(candidate) ? candidate : undefined;
}

export function normalizeTraceparent(value: unknown): string | undefined {
  const candidate: unknown = Array.isArray(value) ? (value as unknown[]).at(0) : value;
  if (typeof candidate !== "string") return undefined;
  const normalized = candidate.toLowerCase();
  return /^00-(?!0{32})[0-9a-f]{32}-(?!0{16})[0-9a-f]{16}-[0-9a-f]{2}$/.test(normalized)
    ? normalized
    : undefined;
}

export function createTraceparent(): string {
  return `00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`;
}
