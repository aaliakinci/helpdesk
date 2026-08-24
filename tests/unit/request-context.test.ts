import { describe, expect, it } from "vitest";

import {
  normalizeTraceparent,
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
    ).toMatchObject({ correlationId: "ticket-flow:42", traceId: "request-42" });
  });

  it("rejects values that could inject log lines", () => {
    expect(normalizeRequestId("request\nsecret=value")).toBeUndefined();
    expect(normalizeRequestId("x".repeat(129))).toBeUndefined();
  });

  it("generates an identifier when the client value is unsafe", () => {
    const identity = resolveRequestIdentity({ "x-request-id": "bad id" });
    expect(identity.traceId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(identity.correlationId).toBe(identity.traceId);
    expect(identity.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
  });

  it("preserves a valid W3C trace context and rejects zero identifiers", () => {
    const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(resolveRequestIdentity({ traceparent }).traceparent).toBe(traceparent);
    expect(normalizeTraceparent(`00-${"0".repeat(32)}-00f067aa0ba902b7-01`)).toBeUndefined();
  });
});
