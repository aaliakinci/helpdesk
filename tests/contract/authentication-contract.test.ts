import { describe, expect, it } from "vitest";

import { decodeLoginInput } from "../../src/server/modules/identity/presentation/identity-contracts.js";
import { createProblemDetails } from "../../src/server/apps/support-api/src/problem-details.filter.js";

describe("authentication HTTP contracts", () => {
  it("normalizes login email and does not accept a free-form tenant identifier", () => {
    expect(
      decodeLoginInput({
        email: "  OWNER@DEMO.HELPDESK.TEST ",
        password: "demo-password",
        tenantId: null,
      }),
    ).toEqual({
      email: "owner@demo.helpdesk.test",
      password: "demo-password",
      tenantId: null,
    });
    expect(() =>
      decodeLoginInput({
        email: "owner@example.test",
        password: "demo-password",
        tenantId: "acme",
      }),
    ).toThrow("identifier is invalid");
  });

  it("uses stable non-disclosing auth and rate-limit problems", () => {
    expect(createProblemDetails(401, "/api/v1/identity/me", "trace-auth")).toMatchObject({
      code: "auth.required",
      status: 401,
      traceId: "trace-auth",
    });
    expect(createProblemDetails(429, "/api/v1/auth/login", "trace-rate")).toMatchObject({
      code: "auth.rate_limited",
      status: 429,
    });
  });
});
