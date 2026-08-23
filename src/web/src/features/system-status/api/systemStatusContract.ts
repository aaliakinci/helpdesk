import { requireNumber, requireRecord, requireString } from "@/shared/api/contractDecoder";

export type CheckStatus = "down" | "up";
export type SystemReadinessStatus = "not_ready" | "ready";

export interface SystemCheck {
  readonly durationMilliseconds: number;
  readonly status: CheckStatus;
}

export interface SystemStatus {
  readonly checks: Readonly<Record<"postgresql" | "rabbitmq" | "redis", SystemCheck>>;
  readonly service: string;
  readonly status: SystemReadinessStatus;
  readonly timestamp: string;
  readonly traceId: string;
  readonly version: string;
}

export function decodeSystemStatus(body: unknown): SystemStatus {
  const value = requireRecord(body, "system status");
  const checks = requireRecord(value.checks, "system checks");
  const status = requireString(value.status, "system status.status");
  if (status !== "ready" && status !== "not_ready") {
    throw new TypeError("system status.status is invalid.");
  }

  return {
    checks: {
      postgresql: decodeCheck(checks.postgresql, "postgresql"),
      rabbitmq: decodeCheck(checks.rabbitmq, "rabbitmq"),
      redis: decodeCheck(checks.redis, "redis"),
    },
    service: requireString(value.service, "system status.service"),
    status,
    timestamp: requireString(value.timestamp, "system status.timestamp"),
    traceId: requireString(value.traceId, "system status.traceId"),
    version: requireString(value.version, "system status.version"),
  };
}

function decodeCheck(body: unknown, name: string): SystemCheck {
  const value = requireRecord(body, `${name} check`);
  const status = requireString(value.status, `${name} check.status`);
  if (status !== "up" && status !== "down") {
    throw new TypeError(`${name} check.status is invalid.`);
  }
  return {
    durationMilliseconds: requireNumber(
      value.durationMilliseconds,
      `${name} check.durationMilliseconds`,
    ),
    status,
  };
}
