import { describe, expect, it } from "vitest";

import { selectNextRoundRobinMember } from "../../src/server/modules/support/domain/round-robin-policy.js";

describe("round-robin assignment policy", () => {
  it("sorts candidates deterministically and wraps after the cursor", () => {
    expect(selectNextRoundRobinMember(["member-c", "member-a", "member-b"], null)).toBe("member-a");
    expect(selectNextRoundRobinMember(["member-c", "member-a", "member-b"], "member-a")).toBe(
      "member-b",
    );
    expect(selectNextRoundRobinMember(["member-c", "member-a", "member-b"], "member-c")).toBe(
      "member-a",
    );
  });

  it("resets a missing cursor and returns null without candidates", () => {
    expect(selectNextRoundRobinMember(["member-b", "member-a", "member-a"], "disabled")).toBe(
      "member-a",
    );
    expect(selectNextRoundRobinMember([], null)).toBeNull();
  });
});
