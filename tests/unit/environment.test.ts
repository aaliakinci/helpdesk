import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../../src/server/platform/config/environment.js";

const validEnvironment = {
  ACCESS_TOKEN_SECRET: "test-access-token-secret-at-least-32-bytes",
  DATABASE_URL: "postgresql://helpdesk:secret@127.0.0.1:5432/helpdesk",
  RABBITMQ_URL: "amqp://helpdesk:secret@127.0.0.1:5672/helpdesk",
  REDIS_URL: "redis://127.0.0.1:6379",
  WEB_ORIGIN: "http://127.0.0.1:5173",
};

describe("parseEnvironment", () => {
  it("applies safe service defaults without changing connection URLs", () => {
    const result = parseEnvironment(validEnvironment);

    expect(result).toMatchObject({
      accessTokenTtlSeconds: 600,
      apiPort: 8080,
      appVersion: "0.0.0",
      nodeEnvironment: "development",
      messagingMaxAttempts: 5,
      outboxBatchSize: 25,
      outboxLeaseSeconds: 30,
      outboxPollIntervalMs: 500,
      rabbitMqPrefetch: 8,
      realtimeAuthRecheckMs: 5_000,
      slaSchedulerBatchSize: 50,
      slaSchedulerIntervalMs: 30_000,
      workerHealthPort: 8081,
    });
    expect(result.databaseUrl).toBe(validEnvironment.DATABASE_URL);
  });

  it("requires a strong signing secret and secure production cookie defaults", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, ACCESS_TOKEN_SECRET: "too-short" }),
    ).toThrow("ACCESS_TOKEN_SECRET must contain at least 32 bytes.");
    expect(
      parseEnvironment({
        ...validEnvironment,
        ATTACHMENT_STORAGE_DRIVER: "local",
        NODE_ENV: "production",
      }).refreshCookieSecure,
    ).toBe(true);
  });

  it("requires an explicit storage driver in production and complete S3 credentials", () => {
    expect(() => parseEnvironment({ ...validEnvironment, NODE_ENV: "production" })).toThrow(
      "ATTACHMENT_STORAGE_DRIVER is required in production.",
    );
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        ATTACHMENT_STORAGE_DRIVER: "s3",
        NODE_ENV: "production",
      }),
    ).toThrow("ATTACHMENT_S3_ACCESS_KEY_ID is required.");
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        ATTACHMENT_S3_ACCESS_KEY_ID: "access-key",
        ATTACHMENT_S3_BUCKET: "private-bucket",
        ATTACHMENT_S3_ENDPOINT: "http://objects.example.test",
        ATTACHMENT_S3_REGION: "eu-central-1",
        ATTACHMENT_S3_SECRET_ACCESS_KEY: "s3-secret-at-least-thirty-two-bytes-long",
        ATTACHMENT_STORAGE_DRIVER: "s3",
        NODE_ENV: "production",
      }),
    ).toThrow("ATTACHMENT_S3_ENDPOINT must use HTTPS in production.");
  });

  it("rejects missing infrastructure configuration", () => {
    expect(() => parseEnvironment({ ...validEnvironment, DATABASE_URL: undefined })).toThrow(
      "DATABASE_URL is required.",
    );
  });

  it("rejects unsupported URL protocols and invalid ports", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, REDIS_URL: "http://127.0.0.1:6379" }),
    ).toThrow("REDIS_URL uses an unsupported protocol.");
    expect(() => parseEnvironment({ ...validEnvironment, API_PORT: "70000" })).toThrow(
      "API_PORT must be an integer between 1 and 65535.",
    );
  });

  it("requires an exact web origin and a scoped attachment directory", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, WEB_ORIGIN: "https://helpdesk.example.test/path" }),
    ).toThrow("WEB_ORIGIN must be an HTTP(S) origin");
    expect(() =>
      parseEnvironment({ ...validEnvironment, ATTACHMENT_LOCAL_DIRECTORY: "/" }),
    ).toThrow("ATTACHMENT_LOCAL_DIRECTORY must not use the filesystem root");
  });
});
