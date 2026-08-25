import { describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LocalAttachmentStorage } from "../../src/server/modules/attachments/infrastructure/local-attachment-storage.js";
import { BoundedRateLimiter } from "../../src/server/platform/security/bounded-rate-limiter.js";
import { HttpRateLimitMiddleware } from "../../src/server/platform/security/http-rate-limit.middleware.js";
import { SecurityHeadersMiddleware } from "../../src/server/platform/security/security-headers.middleware.js";

describe("platform request security", () => {
  it("enforces separate upload limits without trusting forwarded headers directly", () => {
    const middleware = new HttpRateLimitMiddleware(
      {
        values: { requestRateLimit: 10, requestRateWindowSeconds: 60, uploadRateLimit: 1 },
      } as never,
      { traceId: "trace-rate-limit" } as never,
    );
    const headers = new Map<string, string>();
    const response = {
      body: "",
      end(body = "") {
        this.body = body;
      },
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
      statusCode: 200,
    };
    const request = {
      ip: "198.51.100.9",
      method: "POST",
      originalUrl: "/api/v1/tickets/00000000-0000-4000-8000-000000000101/attachments?token=secret",
      socket: { remoteAddress: "127.0.0.1" },
    };
    const first = vi.fn();
    middleware.use(request, response, first);
    middleware.use(request, response, vi.fn());

    expect(first).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(429);
    expect(response.body).not.toContain("secret");
    expect(response.body).toContain("trace-rate-limit");
    expect(headers.get("Retry-After")).toBeDefined();
  });

  it("resets rate buckets after the configured window", () => {
    const limiter = new BoundedRateLimiter(2);
    expect(limiter.consume("client", 1, 1_000, 1_000).allowed).toBe(true);
    expect(limiter.consume("client", 1, 1_000, 1_500).allowed).toBe(false);
    expect(limiter.consume("client", 1, 1_000, 2_000).allowed).toBe(true);
  });

  it("sets browser hardening headers and production HSTS", () => {
    const middleware = new SecurityHeadersMiddleware({
      values: { nodeEnvironment: "production" },
    } as never);
    const headers = new Map<string, string>();
    const next = vi.fn();
    middleware.use(
      { originalUrl: "/api/v1/tickets" },
      { setHeader: (name, value) => headers.set(name, value) },
      next,
    );

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(next).toHaveBeenCalledOnce();
  });

  it("allows the generated OpenAPI initializer without relaxing API routes", () => {
    const middleware = new SecurityHeadersMiddleware({
      values: { nodeEnvironment: "development" },
    } as never);
    const headers = new Map<string, string>();
    middleware.use(
      { originalUrl: "/openapi" },
      { setHeader: (name, value) => headers.set(name, value) },
      vi.fn(),
    );

    expect(headers.get("Content-Security-Policy")).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("rejects traversal and malformed local attachment storage keys", async () => {
    const storage = new LocalAttachmentStorage("/tmp/helpdesk-attachment-key-test");

    expect(() => storage.get("../outside")).toThrow("storage key is invalid");
    await expect(
      storage.put("not-a-tenant/not-an-object", Buffer.from("safe"), "text/plain"),
    ).rejects.toThrow("storage key is invalid");
  });

  it("creates and verifies a private writable local attachment root", async () => {
    const parent = await mkdtemp(join(tmpdir(), "helpdesk-storage-ready-"));
    const root = join(parent, "attachments");
    try {
      const storage = new LocalAttachmentStorage(root);
      await expect(storage.ensureReady()).resolves.toBeUndefined();
      expect((await stat(root)).mode & 0o777).toBe(0o700);
    } finally {
      await rm(parent, { force: true, recursive: true });
    }
  });
});
