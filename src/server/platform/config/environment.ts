import { Injectable } from "@nestjs/common";

export type RuntimeEnvironment = "development" | "test" | "production";

export interface PlatformEnvironment {
  readonly apiPort: number;
  readonly appVersion: string;
  readonly databaseUrl: string;
  readonly nodeEnvironment: RuntimeEnvironment;
  readonly rabbitMqUrl: string;
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
  return {
    apiPort: parsePort(environment.API_PORT, 8080, "API_PORT"),
    appVersion: parseVersion(environment.APP_VERSION),
    databaseUrl: requireUrl(environment.DATABASE_URL, "DATABASE_URL", ["postgres:", "postgresql:"]),
    nodeEnvironment: parseNodeEnvironment(environment.NODE_ENV),
    rabbitMqUrl: requireUrl(environment.RABBITMQ_URL, "RABBITMQ_URL", ["amqp:", "amqps:"]),
    redisUrl: requireUrl(environment.REDIS_URL, "REDIS_URL", ["redis:", "rediss:"]),
    webOrigin: requireUrl(environment.WEB_ORIGIN ?? "http://127.0.0.1:5173", "WEB_ORIGIN", [
      "http:",
      "https:",
    ]),
    workerHealthPort: parsePort(environment.WORKER_HEALTH_PORT, 8081, "WORKER_HEALTH_PORT"),
  };
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
