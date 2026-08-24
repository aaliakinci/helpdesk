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

  it("rejects an invented SLA projection", () => {
    expect(() =>
      decodeDashboard({
        myOpenTickets: 1,
        openTickets: 5,
        queues: [],
        sla: { breachedTickets: 2, dueSoonTickets: null, status: "ACTIVE" },
        unassignedTickets: 3,
      }),
    ).toThrow("dashboard.sla");
  });
});
