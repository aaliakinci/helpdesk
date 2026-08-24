import { describe, expect, it } from "vitest";

import {
  addMinutes,
  calculateSlaSnapshot,
  validateSlaTarget,
} from "../../src/server/modules/sla/domain/sla-policy.js";

describe("wall-clock SLA policy", () => {
  it("calculates UTC due instants from the immutable creation instant", () => {
    const createdAt = new Date("2026-03-29T00:30:00.000Z");
    const snapshot = calculateSlaSnapshot(createdAt, {
      approachingBeforeMinutes: 15,
      firstResponseMinutes: 60,
      priority: "HIGH",
      resolutionMinutes: 480,
    });
    expect(snapshot).toEqual({
      firstResponseApproachingAt: new Date("2026-03-29T01:15:00.000Z"),
      firstResponseDueAt: new Date("2026-03-29T01:30:00.000Z"),
      resolutionApproachingAt: new Date("2026-03-29T08:15:00.000Z"),
      resolutionDueAt: new Date("2026-03-29T08:30:00.000Z"),
    });
    expect(addMinutes(createdAt, 60).toISOString()).toBe("2026-03-29T01:30:00.000Z");
  });

  it("requires the warning lead time to be shorter than both targets", () => {
    expect(() =>
      validateSlaTarget({
        approachingBeforeMinutes: 60,
        firstResponseMinutes: 60,
        priority: "HIGH",
        resolutionMinutes: 480,
      }),
    ).toThrow("shorter than both SLA targets");
  });
});
