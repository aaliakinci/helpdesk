import { describe, expect, it } from "vitest";

import { permissionsForRole } from "../../src/server/modules/identity/domain/permissions.js";
import { AccessTokenService } from "../../src/server/modules/identity/security/access-token.js";
import { PasswordHasher } from "../../src/server/modules/identity/security/password-hasher.js";
import { RefreshTokenService } from "../../src/server/modules/identity/security/refresh-token.js";
import {
  parseEnvironment,
  type PlatformConfigService,
} from "../../src/server/platform/config/environment.js";

const environment = parseEnvironment({
  ACCESS_TOKEN_SECRET: "unit-test-access-token-secret-at-least-32-bytes",
  DATABASE_URL: "postgresql://helpdesk:secret@127.0.0.1:5432/helpdesk",
  NODE_ENV: "production",
  RABBITMQ_URL: "amqp://helpdesk:secret@127.0.0.1:5672/helpdesk",
  REDIS_URL: "redis://127.0.0.1:6379",
  WEB_ORIGIN: "https://helpdesk.example.test",
});
const config = { values: environment } as PlatformConfigService;

describe("identity security primitives", () => {
  it("hashes passwords with a random salt and verifies without storing plaintext", async () => {
    const hasher = new PasswordHasher();
    const first = await hasher.hash("a-strong-demo-password");
    const second = await hasher.hash("a-strong-demo-password");

    expect(first).not.toBe(second);
    await expect(hasher.verify("a-strong-demo-password", first)).resolves.toBe(true);
    await expect(hasher.verify("wrong-password", first)).resolves.toBe(false);
    expect(first).not.toContain("a-strong-demo-password");
  });

  it("issues signed, expiring access tokens and rejects tampering", () => {
    const service = new AccessTokenService(config);
    const issued = service.issue({
      membershipId: "00000000-0000-4000-8000-000000000501",
      sessionId: "00000000-0000-4000-8000-000000000601",
      tenantId: "00000000-0000-4000-8000-000000000101",
      userId: "00000000-0000-4000-8000-000000000201",
    });

    expect(service.verify(issued.token)).toMatchObject({
      membershipId: "00000000-0000-4000-8000-000000000501",
      tenantId: "00000000-0000-4000-8000-000000000101",
    });
    const [header, payload, signature = ""] = issued.token.split(".");
    const tampered = `${header}.${payload}.${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    expect(service.verify(tampered)).toBeNull();
  });

  it("serializes refresh credentials with production cookie protections", () => {
    const service = new RefreshTokenService(config);
    const refresh = service.create();
    const cookie = service.serialize(refresh.token, new Date(Date.now() + 60_000));

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/api/v1/auth");
    expect(service.parseCookie(cookie)).toBe(refresh.token);
  });

  it("keeps fixed roles deterministic and Auditor read-only", () => {
    expect(permissionsForRole("OWNER")).toContain("memberships.manage-role");
    expect(permissionsForRole("OWNER")).toContain("sla.manage");
    expect(permissionsForRole("MANAGER")).not.toContain("memberships.manage-role");
    expect(permissionsForRole("MANAGER")).toContain("sla.manage");
    expect(permissionsForRole("AGENT")).toContain("tickets.manage");
    expect(permissionsForRole("AGENT")).toContain("sla.read");
    expect(permissionsForRole("REQUESTER")).toContain("tickets.read-own");
    expect(permissionsForRole("REQUESTER")).not.toContain("sla.read");
    expect(permissionsForRole("AUDITOR")).toContain("audit.read");
    expect(permissionsForRole("AUDITOR")).not.toContain("tickets.manage");
  });
});
