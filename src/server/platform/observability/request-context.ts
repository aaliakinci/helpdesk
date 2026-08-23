import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestContextState {
  readonly correlationId: string;
  readonly traceId: string;
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

  public run<T>(traceId: string, correlationId: string, callback: () => T): T {
    return this.storage.run({ traceId, correlationId }, callback);
  }
}

export function resolveRequestIdentity(headers: Readonly<Record<string, unknown>>): {
  readonly correlationId: string;
  readonly traceId: string;
} {
  const traceId = normalizeRequestId(headers["x-request-id"]) ?? randomUUID();
  const correlationId = normalizeRequestId(headers["x-correlation-id"]) ?? traceId;
  return { traceId, correlationId };
}

export function normalizeRequestId(value: unknown): string | undefined {
  const candidate: unknown = Array.isArray(value) ? (value as unknown[]).at(0) : value;
  return typeof candidate === "string" && SAFE_REQUEST_ID.test(candidate) ? candidate : undefined;
}
