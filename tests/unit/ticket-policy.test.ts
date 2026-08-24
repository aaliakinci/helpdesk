import { describe, expect, it } from "vitest";

import {
  canTransitionTicket,
  TICKET_STATUSES,
  type TicketStatus,
} from "../../src/server/modules/support/domain/ticket-policy.js";

const allowed: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "PENDING", "RESOLVED"],
  OPEN: ["PENDING", "RESOLVED"],
  PENDING: ["OPEN", "RESOLVED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: [],
};

describe("ticket state machine", () => {
  it("matches the complete fixed transition graph", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        expect(canTransitionTicket(from, to), `${from} -> ${to}`).toBe(allowed[from].includes(to));
      }
    }
  });

  it("keeps closed terminal and requires an explicit reopen use case", () => {
    expect(canTransitionTicket("CLOSED", "OPEN")).toBe(false);
    expect(canTransitionTicket("RESOLVED", "OPEN")).toBe(true);
  });
});
