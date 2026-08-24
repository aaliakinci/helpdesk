export const SLA_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export type SlaPriority = (typeof SLA_PRIORITIES)[number];
export type SlaMilestone = "FIRST_RESPONSE" | "RESOLUTION";
export type SlaWarningStage = "APPROACHING" | "BREACHED";

export interface SlaTargetInput {
  readonly approachingBeforeMinutes: number;
  readonly firstResponseMinutes: number;
  readonly priority: SlaPriority;
  readonly resolutionMinutes: number;
}

export interface SlaSnapshot {
  readonly firstResponseApproachingAt: Date;
  readonly firstResponseDueAt: Date;
  readonly resolutionApproachingAt: Date;
  readonly resolutionDueAt: Date;
}

export function calculateSlaSnapshot(createdAt: Date, target: SlaTargetInput): SlaSnapshot {
  return {
    firstResponseApproachingAt: addMinutes(
      createdAt,
      target.firstResponseMinutes - target.approachingBeforeMinutes,
    ),
    firstResponseDueAt: addMinutes(createdAt, target.firstResponseMinutes),
    resolutionApproachingAt: addMinutes(
      createdAt,
      target.resolutionMinutes - target.approachingBeforeMinutes,
    ),
    resolutionDueAt: addMinutes(createdAt, target.resolutionMinutes),
  };
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

export function validateSlaTarget(target: SlaTargetInput): void {
  if (!SLA_PRIORITIES.includes(target.priority)) throw new Error("SLA priority is invalid.");
  assertIntegerRange(target.firstResponseMinutes, 2, 43_200, "first response");
  assertIntegerRange(target.resolutionMinutes, 2, 43_200, "resolution");
  assertIntegerRange(target.approachingBeforeMinutes, 1, 43_199, "approaching threshold");
  if (
    target.approachingBeforeMinutes >= target.firstResponseMinutes ||
    target.approachingBeforeMinutes >= target.resolutionMinutes
  ) {
    throw new Error("Approaching threshold must be shorter than both SLA targets.");
  }
}

function assertIntegerRange(value: number, minimum: number, maximum: number, name: string): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
}
