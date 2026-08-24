import {
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export type SlaPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface SlaPolicyTarget {
  readonly approachingBeforeMinutes: number;
  readonly firstResponseMinutes: number;
  readonly priority: SlaPriority;
  readonly resolutionMinutes: number;
}

export interface SlaPolicy {
  readonly autoCloseResolvedMinutes: number;
  readonly id: string;
  readonly targets: readonly SlaPolicyTarget[];
  readonly updatedAtUtc: string;
  readonly version: number;
}

export interface SaveSlaPolicyRequest {
  readonly autoCloseResolvedMinutes: number;
  readonly expectedVersion: number | null;
  readonly targets: readonly SlaPolicyTarget[];
}

const PRIORITIES: readonly SlaPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function decodeSlaPolicy(body: unknown): SlaPolicy | null {
  if (body === null) return null;
  const value = requireRecord(body, "SLA policy");
  return {
    autoCloseResolvedMinutes: requireNumber(
      value.autoCloseResolvedMinutes,
      "policy.autoCloseResolvedMinutes",
    ),
    id: requireString(value.id, "policy.id"),
    targets: requireArray(value.targets, "policy.targets").map((item) => {
      const target = requireRecord(item, "SLA target");
      return {
        approachingBeforeMinutes: requireNumber(
          target.approachingBeforeMinutes,
          "target.approachingBeforeMinutes",
        ),
        firstResponseMinutes: requireNumber(
          target.firstResponseMinutes,
          "target.firstResponseMinutes",
        ),
        priority: decodePriority(target.priority),
        resolutionMinutes: requireNumber(target.resolutionMinutes, "target.resolutionMinutes"),
      };
    }),
    updatedAtUtc: requireString(value.updatedAtUtc, "policy.updatedAtUtc"),
    version: requireNumber(value.version, "policy.version"),
  };
}

function decodePriority(value: unknown): SlaPriority {
  if (typeof value !== "string" || !PRIORITIES.includes(value as SlaPriority)) {
    throw new TypeError("SLA target priority is invalid.");
  }
  return value as SlaPriority;
}
