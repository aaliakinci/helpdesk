import { BadRequestException } from "@nestjs/common";

import {
  SLA_PRIORITIES,
  type SlaPriority,
  type SlaTargetInput,
  validateSlaTarget,
} from "../domain/sla-policy.js";

export function decodeSlaPolicyWrite(body: unknown): {
  readonly autoCloseResolvedMinutes: number;
  readonly expectedVersion: number | null;
  readonly targets: readonly SlaTargetInput[];
} {
  const value = requireRecord(body, "request body");
  assertKeys(value, ["autoCloseResolvedMinutes", "expectedVersion", "targets"]);
  const targets = requireArray(value.targets, "targets").map((item) => {
    const target = requireRecord(item, "SLA target");
    assertKeys(target, [
      "approachingBeforeMinutes",
      "firstResponseMinutes",
      "priority",
      "resolutionMinutes",
    ]);
    const decoded: SlaTargetInput = {
      approachingBeforeMinutes: requireInteger(
        target.approachingBeforeMinutes,
        "approachingBeforeMinutes",
      ),
      firstResponseMinutes: requireInteger(target.firstResponseMinutes, "firstResponseMinutes"),
      priority: requirePriority(target.priority),
      resolutionMinutes: requireInteger(target.resolutionMinutes, "resolutionMinutes"),
    };
    try {
      validateSlaTarget(decoded);
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "SLA target is invalid.",
      );
    }
    return decoded;
  });
  if (
    targets.length !== SLA_PRIORITIES.length ||
    new Set(targets.map((target) => target.priority)).size !== SLA_PRIORITIES.length
  ) {
    throw new BadRequestException("Exactly one target for every priority is required.");
  }
  const autoCloseResolvedMinutes = requireInteger(
    value.autoCloseResolvedMinutes,
    "autoCloseResolvedMinutes",
  );
  if (autoCloseResolvedMinutes < 60 || autoCloseResolvedMinutes > 43_200) {
    throw new BadRequestException("autoCloseResolvedMinutes must be between 60 and 43200 minutes.");
  }
  const expectedVersion = value.expectedVersion;
  if (
    expectedVersion !== null &&
    (!Number.isInteger(expectedVersion) || Number(expectedVersion) < 1)
  ) {
    throw new BadRequestException("expectedVersion must be null or a positive integer.");
  }
  return {
    autoCloseResolvedMinutes,
    expectedVersion: expectedVersion === null ? null : Number(expectedVersion),
    targets,
  };
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new BadRequestException(`${name} must be an array.`);
  return value;
}

function requireInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value)) throw new BadRequestException(`${name} must be an integer.`);
  return Number(value);
}

function requirePriority(value: unknown): SlaPriority {
  if (typeof value !== "string" || !SLA_PRIORITIES.includes(value as SlaPriority)) {
    throw new BadRequestException("priority is invalid.");
  }
  return value as SlaPriority;
}

function assertKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new BadRequestException("request contains an unsupported field.");
  }
}
