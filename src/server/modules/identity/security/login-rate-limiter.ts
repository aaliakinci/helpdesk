import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { PlatformConfigService } from "../../../platform/index.js";

interface AttemptWindow {
  count: number;
  expiresAt: number;
}

@Injectable()
export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  public constructor(private readonly config: PlatformConfigService) {}

  public key(clientAddress: string, normalizedEmail: string): string {
    return createHash("sha256")
      .update(`${clientAddress}\u0000${normalizedEmail}`, "utf8")
      .digest("hex");
  }

  public assertAllowed(key: string): void {
    const current = this.current(key);
    if (current && current.count >= this.config.values.authLoginLimit) {
      throw new HttpException("Too many login attempts.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  public recordFailure(key: string): void {
    const current = this.current(key);
    this.attempts.set(key, {
      count: (current?.count ?? 0) + 1,
      expiresAt:
        current?.expiresAt ?? Date.now() + this.config.values.authLoginWindowSeconds * 1_000,
    });
  }

  public reset(key: string): void {
    this.attempts.delete(key);
  }

  private current(key: string): AttemptWindow | null {
    const current = this.attempts.get(key);
    if (!current) return null;
    if (current.expiresAt <= Date.now()) {
      this.attempts.delete(key);
      return null;
    }
    return current;
  }
}
