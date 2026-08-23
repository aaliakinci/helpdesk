import { afterEach, describe, expect, it } from "vitest";

import { decodeAuthenticationResponse } from "../../src/web/src/features/auth/api/authContract.js";
import { authSessionStore } from "../../src/web/src/features/auth/model/authSessionStore.js";
import { workspaceLandingPath } from "../../src/web/src/features/auth/model/workspaceLanding.js";

const authenticatedResponse = {
  accessToken: "signed-access-token",
  accessTokenExpiresAtUtc: "2026-08-23T20:00:00.000Z",
  activeTenant: {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Acme Support",
    permissions: ["tenant.read", "tickets.manage"],
    role: "AGENT",
    slug: "acme-support",
    timeZone: "Europe/Istanbul",
  },
  requiresTenantSelection: false,
  tenants: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Acme Support",
      role: "AGENT",
      slug: "acme-support",
    },
  ],
  user: {
    displayName: "Demo Agent",
    email: "agent@demo.helpdesk.test",
    id: "00000000-0000-4000-8000-000000000203",
  },
};

describe("web authentication session", () => {
  afterEach(() => authSessionStore.clear());

  it("decodes and retains the access token only in the in-memory session store", () => {
    const response = decodeAuthenticationResponse(authenticatedResponse);
    authSessionStore.setAuthentication(response);

    expect(authSessionStore.getAccessToken()).toBe("signed-access-token");
    expect(authSessionStore.getSnapshot().session?.activeTenant.role).toBe("AGENT");
    authSessionStore.clear();
    expect(authSessionStore.getAccessToken()).toBeNull();
  });

  it("rejects inconsistent tenant-selection responses", () => {
    expect(() =>
      decodeAuthenticationResponse({
        ...authenticatedResponse,
        requiresTenantSelection: true,
      }),
    ).toThrow("Tenant-selection response is inconsistent");
  });

  it("selects role-aware landing paths", () => {
    expect(workspaceLandingPath("OWNER")).toBe("/workspace");
    expect(workspaceLandingPath("MANAGER")).toBe("/workspace");
    expect(workspaceLandingPath("AGENT")).toBe("/workspace");
    expect(workspaceLandingPath("REQUESTER")).toBe("/portal");
    expect(workspaceLandingPath("AUDITOR")).toBe("/audit");
  });
});
