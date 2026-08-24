import { describe, expect, it } from "vitest";

import { decodeMemberships } from "../../src/web/src/features/audit/api/auditContract";

describe("read-only auditor web contract", () => {
  it("decodes tenant membership projections without mutation state", () => {
    expect(
      decodeMemberships([
        {
          customerContactId: null,
          id: "membership-1",
          role: "AUDITOR",
          status: "ACTIVE",
          tenantId: "tenant-1",
          user: { displayName: "Audit User", email: "audit@example.test", id: "user-1" },
        },
      ]),
    ).toEqual([
      {
        id: "membership-1",
        role: "AUDITOR",
        status: "ACTIVE",
        user: { displayName: "Audit User", email: "audit@example.test", id: "user-1" },
      },
    ]);
  });

  it("rejects invented roles and statuses", () => {
    expect(() =>
      decodeMemberships([
        {
          id: "membership-1",
          role: "SUPERUSER",
          status: "ACTIVE",
          user: { displayName: "User", email: "user@example.test", id: "user-1" },
        },
      ]),
    ).toThrow("membership.role");
  });
});
