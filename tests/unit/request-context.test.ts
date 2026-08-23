import { describe, expect, it } from "vitest";

import {
  normalizeRequestId,
  resolveRequestIdentity,
} from "../../src/server/platform/observability/request-context.js";

describe("request identity", () => {
  it("keeps bounded safe request and correlation identifiers", () => {
    expect(
      resolveRequestIdentity({
        "x-correlation-id": "ticket-flow:42",
        "x-request-id": "request-42",
      }),
    ).toEqual({ correlationId: "ticket-flow:42", traceId: "request-42" });
  });

  it("rejects values that could inject log lines", () => {
    expect(normalizeRequestId("request\nsecret=value")).toBeUndefined();
    expect(normalizeRequestId("x".repeat(129))).toBeUndefined();
  });

  it("generates an identifier when the client value is unsafe", () => {
    const identity = resolveRequestIdentity({ "x-request-id": "bad id" });
    expect(identity.traceId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(identity.correlationId).toBe(identity.traceId);
  });
});
