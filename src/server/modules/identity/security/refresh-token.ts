import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { PlatformConfigService } from "../../../platform/index.js";

@Injectable()
export class RefreshTokenService {
  public constructor(private readonly config: PlatformConfigService) {}

  public create(): { readonly hash: string; readonly token: string } {
    const token = randomBytes(32).toString("base64url");
    return { hash: this.hash(token), token };
  }

  public hash(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  public parseCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    for (const pair of cookieHeader.split(";")) {
      const separator = pair.indexOf("=");
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      if (name !== this.config.values.refreshCookieName) continue;
      const value = pair.slice(separator + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
    return null;
  }

  public serialize(token: string, expiresAt: Date): string {
    return this.serializeBase(
      `${encodeURIComponent(this.config.values.refreshCookieName)}=${token}`,
      [
        `Expires=${expiresAt.toUTCString()}`,
        `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1_000))}`,
      ],
    );
  }

  public clear(): string {
    return this.serializeBase(`${encodeURIComponent(this.config.values.refreshCookieName)}=`, [
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "Max-Age=0",
    ]);
  }

  private serializeBase(value: string, attributes: readonly string[]): string {
    return [
      value,
      ...attributes,
      "Path=/api/v1/auth",
      "HttpOnly",
      "SameSite=Strict",
      ...(this.config.values.refreshCookieSecure ? ["Secure"] : []),
    ].join("; ");
  }
}
