import { describe, expect, it } from "vitest";

import { decodeSystemStatus } from "../../src/web/src/features/system-status/api/systemStatusContract";

const validStatus = {
  checks: {
    postgresql: { durationMilliseconds: 1.2, status: "up" },
    rabbitmq: { durationMilliseconds: 2.3, status: "up" },
    redis: { durationMilliseconds: 0.4, status: "up" },
  },
  service: "support-api",
  status: "ready",
  timestamp: "2026-08-23T20:30:00.000Z",
  traceId: "trace-1",
  version: "0.0.0",
};

describe("system status contract", () => {
  it("decodes the API readiness response", () => {
    expect(decodeSystemStatus(validStatus)).toEqual(validStatus);
  });

  it("rejects unknown readiness and dependency states", () => {
    expect(() => decodeSystemStatus({ ...validStatus, status: "healthy" })).toThrow();
    expect(() =>
      decodeSystemStatus({
        ...validStatus,
        checks: {
          ...validStatus.checks,
          redis: { durationMilliseconds: 1, status: "unknown" },
        },
      }),
    ).toThrow();
  });
});
