import { describe, expect, it } from "vitest";

import {
  decodeCommentWrite,
  decodeCreateTicket,
  decodeStatusWrite,
  decodeTicketListQuery,
} from "../../src/server/modules/support/presentation/support-contracts.js";

describe("customer and ticket HTTP contracts", () => {
  it("normalizes bounded create input and rejects unsupported tenant scope", () => {
    expect(
      decodeCreateTicket({
        description: "  A detailed problem  ",
        priority: "HIGH",
        requesterContactId: null,
        subject: "  Printer is unavailable  ",
      }),
    ).toEqual({
      description: "A detailed problem",
      priority: "HIGH",
      requesterContactId: null,
      subject: "Printer is unavailable",
    });
    expect(() =>
      decodeCreateTicket({
        description: "Problem",
        priority: "NORMAL",
        requesterContactId: null,
        subject: "Valid subject",
        tenantId: "00000000-0000-4000-8000-000000000102",
      }),
    ).toThrow("unsupported field");
  });

  it("requires expected revisions on comments and status mutations", () => {
    expect(
      decodeCommentWrite({ body: "Reply", expectedVersion: 3, visibility: "INTERNAL" }),
    ).toEqual({ body: "Reply", expectedVersion: 3, visibility: "INTERNAL" });
    expect(decodeStatusWrite({ expectedVersion: 4, status: "RESOLVED" })).toEqual({
      expectedVersion: 4,
      status: "RESOLVED",
    });
    expect(() => decodeCommentWrite({ body: "Reply", visibility: "PUBLIC" })).toThrow(
      "expectedVersion",
    );
  });

  it("bounds pagination, filtering, and sorting", () => {
    expect(
      decodeTicketListQuery({
        page: "2",
        pageSize: "25",
        priority: "URGENT",
        sortBy: "number",
        sortDirection: "asc",
        status: "OPEN",
      }),
    ).toEqual({
      page: 2,
      pageSize: 25,
      priority: "URGENT",
      sortBy: "number",
      sortDirection: "asc",
      status: "OPEN",
    });
    expect(() => decodeTicketListQuery({ pageSize: "101" })).toThrow("allowed range");
  });
});
