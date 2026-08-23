import { Injectable } from "@nestjs/common";

export type RuntimeEnvironment = "development" | "test" | "production";

export interface PlatformEnvironment {
  readonly accessTokenAudience: string;
  readonly accessTokenIssuer: string;
  readonly accessTokenSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly apiPort: number;
  readonly appVersion: string;
  readonly authLoginLimit: number;
  readonly authLoginWindowSeconds: number;
  readonly databaseUrl: string;
  readonly nodeEnvironment: RuntimeEnvironment;
  readonly rabbitMqUrl: string;
  readonly refreshCookieName: string;
  readonly refreshCookieSecure: boolean;
  readonly refreshSessionTtlDays: number;
  readonly redisUrl: string;
  readonly webOrigin: string;
  readonly workerHealthPort: number;
}

@Injectable()
export class PlatformConfigService {
  public readonly values: PlatformEnvironment;

  public constructor() {
    this.values = parseEnvironment(process.env);
  }
}

export function parseEnvironment(environment: NodeJS.ProcessEnv): PlatformEnvironment {
  const nodeEnvironment = parseNodeEnvironment(environment.NODE_ENV);
  return {
    accessTokenAudience: parseIdentifier(
      environment.ACCESS_TOKEN_AUDIENCE,
      "helpdesk-support-api",
      "ACCESS_TOKEN_AUDIENCE",
    ),
    accessTokenIssuer: parseIdentifier(
      environment.ACCESS_TOKEN_ISSUER,
      "helpdesk",
      "ACCESS_TOKEN_ISSUER",
    ),
    accessTokenSecret: requireSecret(environment.ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET"),
    accessTokenTtlSeconds: parseInteger(
      environment.ACCESS_TOKEN_TTL_SECONDS,
      600,
      "ACCESS_TOKEN_TTL_SECONDS",
      60,
      3_600,
    ),
    apiPort: parsePort(environment.API_PORT, 8080, "API_PORT"),
    appVersion: parseVersion(environment.APP_VERSION),
    authLoginLimit: parseInteger(environment.AUTH_LOGIN_LIMIT, 5, "AUTH_LOGIN_LIMIT", 1, 100),
    authLoginWindowSeconds: parseInteger(
      environment.AUTH_LOGIN_WINDOW_SECONDS,
      60,
      "AUTH_LOGIN_WINDOW_SECONDS",
      10,
      3_600,
    ),
    databaseUrl: requireUrl(environment.DATABASE_URL, "DATABASE_URL", ["postgres:", "postgresql:"]),
    nodeEnvironment,
    rabbitMqUrl: requireUrl(environment.RABBITMQ_URL, "RABBITMQ_URL", ["amqp:", "amqps:"]),
    refreshCookieName: parseIdentifier(
      environment.REFRESH_COOKIE_NAME,
      "helpdesk_refresh",
      "REFRESH_COOKIE_NAME",
    ),
    refreshCookieSecure: parseBoolean(
      environment.REFRESH_COOKIE_SECURE,
      nodeEnvironment === "production",
      "REFRESH_COOKIE_SECURE",
    ),
    refreshSessionTtlDays: parseInteger(
      environment.REFRESH_SESSION_TTL_DAYS,
      7,
      "REFRESH_SESSION_TTL_DAYS",
      1,
      90,
    ),
    redisUrl: requireUrl(environment.REDIS_URL, "REDIS_URL", ["redis:", "rediss:"]),
    webOrigin: requireUrl(environment.WEB_ORIGIN ?? "http://127.0.0.1:5173", "WEB_ORIGIN", [
      "http:",
      "https:",
    ]),
    workerHealthPort: parsePort(environment.WORKER_HEALTH_PORT, 8081, "WORKER_HEALTH_PORT"),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function parseIdentifier(value: string | undefined, fallback: string, name: string): string {
  const candidate = value?.trim() || fallback;
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(candidate)) {
    throw new Error(`${name} has an invalid format.`);
  }
  return candidate;
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(candidate) || candidate < minimum || candidate > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return candidate;
}

function parseNodeEnvironment(value: string | undefined): RuntimeEnvironment {
  const candidate = value ?? "development";
  if (candidate === "development" || candidate === "test" || candidate === "production") {
    return candidate;
  }

  throw new Error("NODE_ENV must be development, test, or production.");
}

function parsePort(value: string | undefined, fallback: number, name: string): number {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(candidate) || candidate < 1 || candidate > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return candidate;
}

function parseVersion(value: string | undefined): string {
  const candidate = value?.trim() || "0.0.0";
  if (!/^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(candidate)) {
    throw new Error("APP_VERSION has an invalid format.");
  }

  return candidate;
}

function requireSecret(value: string | undefined, name: string): string {
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error(`${name} must contain at least 32 bytes.`);
  }
  return value;
}

function requireUrl(
  value: string | undefined,
  name: string,
  allowedProtocols: readonly string[],
): string {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(`${name} uses an unsupported protocol.`);
  }

  return value;
}
