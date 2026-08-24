import { describe, expect, it } from "vitest";

import { decodeSlaPolicyWrite } from "../../src/server/modules/sla/presentation/sla-contracts.js";

const targets = [
  {
    approachingBeforeMinutes: 60,
    firstResponseMinutes: 480,
    priority: "LOW",
    resolutionMinutes: 2880,
  },
  {
    approachingBeforeMinutes: 60,
    firstResponseMinutes: 240,
    priority: "NORMAL",
    resolutionMinutes: 1440,
  },
  {
    approachingBeforeMinutes: 15,
    firstResponseMinutes: 60,
    priority: "HIGH",
    resolutionMinutes: 480,
  },
  {
    approachingBeforeMinutes: 5,
    firstResponseMinutes: 15,
    priority: "URGENT",
    resolutionMinutes: 240,
  },
];

describe("SLA policy HTTP contract", () => {
  it("requires one bounded target per priority and optimistic policy revision", () => {
    const decoded = decodeSlaPolicyWrite({
      autoCloseResolvedMinutes: 4320,
      expectedVersion: 2,
      targets,
    });
    expect(decoded.expectedVersion).toBe(2);
    expect(decoded.targets.map((target) => target.priority)).toContain("URGENT");
    expect(() =>
      decodeSlaPolicyWrite({
        autoCloseResolvedMinutes: 4320,
        expectedVersion: 2,
        targets: targets.slice(0, 3),
      }),
    ).toThrow("Exactly one target");
  });
});
