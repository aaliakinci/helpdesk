import { describe, expect, it } from "vitest";

import { workspaceNavigationFor } from "../../src/web/src/features/auth/model/workspaceNavigation";

describe("workspace navigation", () => {
  it("exposes separate staff ticket, creation, queue, and account destinations", () => {
    expect(
      workspaceNavigationFor("OWNER", [
        "tickets.read",
        "tickets.create",
        "queues.read",
        "sla.read",
        "audit.read",
      ]).map((item) => item.path),
    ).toEqual([
      "/workspace/operations",
      "/workspace",
      "/workspace/tickets/new",
      "/workspace/queues",
      "/audit",
      "/account",
    ]);
  });

  it("keeps requester and auditor navigation inside their role boundaries", () => {
    expect(workspaceNavigationFor("REQUESTER", ["tickets.read-own", "tickets.create"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/portal" }),
        expect.objectContaining({ path: "/portal/tickets/new" }),
      ]),
    );
    expect(workspaceNavigationFor("AUDITOR", ["audit.read"]).map((item) => item.path)).toEqual([
      "/audit",
      "/account",
    ]);
  });
});
