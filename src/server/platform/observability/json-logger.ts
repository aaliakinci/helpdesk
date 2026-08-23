import type { LoggerService } from "@nestjs/common";

export type LogLevel = "debug" | "error" | "info" | "warn";
export type SafeLogValue = boolean | number | string | null;
export type SafeLogMetadata = Readonly<Record<string, SafeLogValue>>;

export class JsonLogger implements LoggerService {
  public constructor(private readonly service: string) {}

  public debug(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("debug", message, optionalParameters);
  }

  public error(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("error", message, optionalParameters);
  }

  public fatal(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("error", message, optionalParameters);
  }

  public log(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("info", message, optionalParameters);
  }

  public verbose(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("debug", message, optionalParameters);
  }

  public warn(message: unknown, ...optionalParameters: unknown[]): void {
    this.write("warn", message, optionalParameters);
  }

  private write(level: LogLevel, message: unknown, optionalParameters: readonly unknown[]): void {
    const context = optionalParameters.findLast(
      (value): value is string => typeof value === "string",
    );
    writeStructuredLog(this.service, level, normalizeMessage(message), {
      ...(context ? { context } : {}),
    });
  }
}

export function writeStructuredLog(
  service: string,
  level: LogLevel,
  event: string,
  metadata: SafeLogMetadata = {},
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    ...metadata,
  });

  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

function normalizeMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }

  if (message instanceof Error) {
    return message.name;
  }

  return "framework.event";
}
