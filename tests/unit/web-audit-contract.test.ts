import { describe, expect, it } from "vitest";

import { decodeAuditPage } from "../../src/web/src/features/audit/api/auditContract";

describe("read-only auditor web contract", () => {
  it("decodes a server-paginated audit projection with safe metadata", () => {
    expect(
      decodeAuditPage({
        items: [
          {
            action: "ticket.status.changed",
            actor: { displayName: "Audit User", id: "user-1", type: "USER" },
            aggregateId: "ticket-1",
            aggregateType: "ticket",
            id: "audit-1",
            metadata: { fromStatus: "OPEN", toStatus: "PENDING", version: 3 },
            occurredAtUtc: "2026-08-25T10:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1,
      }),
    ).toMatchObject({
      items: [
        {
          action: "ticket.status.changed",
          actor: { displayName: "Audit User", id: "user-1", type: "USER" },
          metadata: { fromStatus: "OPEN", toStatus: "PENDING", version: 3 },
        },
      ],
      page: 1,
      total: 1,
    });
  });

  it("rejects invalid actor types and nested metadata", () => {
    const page = {
      items: [
        {
          action: "ticket.created",
          actor: { displayName: null, id: null, type: "SERVICE" },
          aggregateId: "ticket-1",
          aggregateType: "ticket",
          id: "audit-1",
          metadata: null,
          occurredAtUtc: "2026-08-25T10:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    };
    expect(() => decodeAuditPage(page)).toThrow("actor.type");
    expect(() =>
      decodeAuditPage({
        ...page,
        items: [
          {
            ...page.items[0],
            actor: { displayName: null, id: null, type: "SYSTEM" },
            metadata: { payload: { secret: "must-not-be-decoded" } },
          },
        ],
      }),
    ).toThrow("audit metadata.payload");
  });
});
