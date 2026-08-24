import { describe, expect, it } from "vitest";

import {
  decodeDashboard,
  decodeQueue,
} from "../../src/web/src/features/operations/api/operationsContract.js";

describe("web operations runtime contracts", () => {
  it("decodes queue members and operational counts", () => {
    expect(
      decodeQueue({
        activeMemberCount: 1,
        createdAtUtc: "2026-08-24T08:00:00.000Z",
        description: null,
        id: "queue-1",
        members: [
          {
            displayName: "Agent One",
            email: "agent@example.test",
            membershipId: "membership-1",
            role: "AGENT",
            status: "ACTIVE",
          },
        ],
        name: "General",
        openTicketCount: 4,
        status: "ACTIVE",
        unassignedTicketCount: 2,
        updatedAtUtc: "2026-08-24T08:00:00.000Z",
        version: 3,
      }),
    ).toMatchObject({ activeMemberCount: 1, name: "General", openTicketCount: 4, version: 3 });
  });

  it("decodes active SLA metrics and rejects malformed warning projections", () => {
    expect(
      decodeDashboard({
        myOpenTickets: 1,
        openTickets: 5,
        queues: [],
        sla: {
          approachingTickets: 1,
          breachedTickets: 2,
          status: "ACTIVE",
          warnings: [],
        },
        unassignedTickets: 3,
      }),
    ).toMatchObject({ sla: { approachingTickets: 1, breachedTickets: 2, status: "ACTIVE" } });
    expect(() =>
      decodeDashboard({
        myOpenTickets: 1,
        openTickets: 5,
        queues: [],
        sla: { approachingTickets: null, breachedTickets: 2, status: "ACTIVE", warnings: [] },
        unassignedTickets: 3,
      }),
    ).toThrow("dashboard.sla.approachingTickets");
  });
});
