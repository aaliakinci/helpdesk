import { describe, expect, it } from "vitest";

import {
  defaultTicketListQuery,
  parseTicketListQuery,
  serializeTicketListQuery,
} from "../../src/web/src/features/tickets/model/ticketListQuery";

describe("ticket list URL state", () => {
  it("round-trips shareable server-side list state", () => {
    const state = parseTicketListQuery(
      "?search=printer&status=OPEN&priority=HIGH&assignment=MINE&queueId=00000000-0000-4000-8000-000000000703&sortBy=number&sortDirection=asc&page=3&pageSize=25",
    );
    expect(parseTicketListQuery(serializeTicketListQuery(state))).toEqual(state);
  });

  it("normalizes unsupported and unbounded URL values", () => {
    expect(
      parseTicketListQuery(
        "?status=INVENTED&assignment=OTHER&queueId=not-a-uuid&page=0&pageSize=100&sortBy=subject",
      ),
    ).toEqual(defaultTicketListQuery);
  });
});
