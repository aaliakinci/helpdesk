export type HealthState = "down" | "up";
export type ReadinessState = "not_ready" | "ready";

export interface HealthCheckResult {
  readonly durationMilliseconds: number;
  readonly status: HealthState;
}

export interface ReadinessReport {
  readonly checks: Readonly<Record<"postgresql" | "rabbitmq" | "redis", HealthCheckResult>>;
  readonly service: string;
  readonly status: ReadinessState;
  readonly timestamp: string;
  readonly traceId: string;
  readonly version: string;
}

export interface LivenessReport {
  readonly service: string;
  readonly status: "alive";
  readonly timestamp: string;
  readonly traceId: string;
  readonly version: string;
}
