import { describe, expect, it } from "vitest";

import { createProblemDetails } from "../../src/server/apps/support-api/src/problem-details.filter.js";

describe("Problem Details", () => {
  it("returns a stable not-found contract without exception internals", () => {
    expect(createProblemDetails(404, "/missing", "trace-1")).toEqual({
      code: "resource.not_found",
      detail: "The requested resource was not found.",
      instance: "/missing",
      status: 404,
      title: "Not found",
      traceId: "trace-1",
      type: "https://helpdesk.example/problems/resource.not_found",
    });
  });

  it("uses a generic detail for unexpected failures", () => {
    const problem = createProblemDetails(500, "/api/v1/system/status", "trace-2");
    expect(problem.code).toBe("internal.unexpected");
    expect(problem.detail).toBe("An unexpected error occurred.");
  });
});
