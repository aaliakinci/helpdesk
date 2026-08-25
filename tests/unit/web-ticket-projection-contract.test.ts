import { describe, expect, it } from "vitest";

import {
  decodeTicketDetail,
  decodeTicketPage,
} from "../../src/web/src/features/tickets/api/ticketContract.js";

const requester = {
  contactId: "contact-1",
  customerId: "customer-1",
  customerName: "Example Customer",
  displayName: "Example Requester",
  email: "requester@example.test",
};

const requesterSummary = {
  assignmentStatus: "ASSIGNED",
  createdAtUtc: "2026-08-24T08:00:00.000Z",
  firstResponseAtUtc: null,
  id: "ticket-1",
  number: 1,
  priority: "NORMAL",
  requester,
  status: "OPEN",
  subject: "Requester-safe projection",
  updatedAtUtc: "2026-08-24T08:01:00.000Z",
  version: 2,
};

describe("requester ticket projection contract", () => {
  it("decodes assignment state without inventing operational assignment fields", () => {
    const page = decodeTicketPage({
      items: [requesterSummary],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    expect(page.items[0]).toMatchObject({ assignmentStatus: "ASSIGNED", id: "ticket-1" });
    expect(page.items[0]).not.toHaveProperty("assignedAtUtc");
    expect(page.items[0]).not.toHaveProperty("assignee");
    expect(page.items[0]).not.toHaveProperty("queue");
  });

  it("decodes requester detail without assignment or status history", () => {
    const detail = decodeTicketDetail({
      ...requesterSummary,
      attachments: [],
      closedAtUtc: null,
      comments: [],
      description: "The requester can inspect their ticket without operational data.",
      reopenedFrom: null,
      reopenedTickets: [],
      resolvedAtUtc: null,
      tags: [],
    });

    expect(detail.assignmentStatus).toBe("ASSIGNED");
    expect(detail).not.toHaveProperty("assignmentHistory");
    expect(detail).not.toHaveProperty("priorityHistory");
    expect(detail).not.toHaveProperty("statusHistory");
    expect(detail).not.toHaveProperty("sla");
  });

  it("decodes staff priority history as a separate activity projection", () => {
    const detail = decodeTicketDetail({
      ...requesterSummary,
      assignmentHistory: [],
      attachments: [],
      closedAtUtc: null,
      comments: [],
      description: "Staff activity projection",
      priorityHistory: [
        {
          actor: { displayName: "Demo Manager", id: "user-1", type: "USER" },
          fromPriority: "NORMAL",
          id: "audit-1",
          occurredAtUtc: "2026-08-25T08:30:07.484Z",
          toPriority: "HIGH",
        },
      ],
      reopenedFrom: null,
      reopenedTickets: [],
      resolvedAtUtc: null,
      sla: null,
      statusHistory: [],
      tags: [],
    });

    expect(detail.priorityHistory).toEqual([
      expect.objectContaining({ fromPriority: "NORMAL", toPriority: "HIGH" }),
    ]);
  });
});
