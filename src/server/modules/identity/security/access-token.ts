import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

import { PlatformConfigService } from "../../../platform/index.js";

interface AccessTokenClaims {
  readonly aud: string;
  readonly exp: number;
  readonly iat: number;
  readonly iss: string;
  readonly membershipId: string;
  readonly sessionId: string;
  readonly sub: string;
  readonly tenantId: string;
}

export interface IssuedAccessToken {
  readonly expiresAt: Date;
  readonly token: string;
}

@Injectable()
export class AccessTokenService {
  private readonly secret: Buffer;

  public constructor(private readonly config: PlatformConfigService) {
    this.secret = Buffer.from(config.values.accessTokenSecret, "utf8");
  }

  public issue(input: {
    readonly membershipId: string;
    readonly sessionId: string;
    readonly tenantId: string;
    readonly userId: string;
  }): IssuedAccessToken {
    const issuedAt = Math.floor(Date.now() / 1_000);
    const expiresAtSeconds = issuedAt + this.config.values.accessTokenTtlSeconds;
    const header = encodeJson({ alg: "HS256", typ: "JWT" });
    const payload = encodeJson({
      aud: this.config.values.accessTokenAudience,
      exp: expiresAtSeconds,
      iat: issuedAt,
      iss: this.config.values.accessTokenIssuer,
      membershipId: input.membershipId,
      sessionId: input.sessionId,
      sub: input.userId,
      tenantId: input.tenantId,
    } satisfies AccessTokenClaims);
    const unsigned = `${header}.${payload}`;
    return {
      expiresAt: new Date(expiresAtSeconds * 1_000),
      token: `${unsigned}.${this.sign(unsigned).toString("base64url")}`,
    };
  }

  public verify(token: string): AccessTokenClaims | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const headerPart = parts[0] ?? "";
    const payloadPart = parts[1] ?? "";
    const signaturePart = parts[2] ?? "";
    const unsigned = `${headerPart}.${payloadPart}`;

    try {
      const signature = Buffer.from(signaturePart, "base64url");
      const expected = this.sign(unsigned);
      if (signature.length !== expected.length || !timingSafeEqual(signature, expected))
        return null;

      const header = parseJson(headerPart);
      const claims = parseJson(payloadPart);
      if (header.alg !== "HS256" || header.typ !== "JWT") return null;
      if (!isClaims(claims)) return null;
      if (
        claims.aud !== this.config.values.accessTokenAudience ||
        claims.iss !== this.config.values.accessTokenIssuer ||
        claims.exp <= Math.floor(Date.now() / 1_000)
      ) {
        return null;
      }
      return claims;
    } catch {
      return null;
    }
  }

  private sign(value: string): Buffer {
    return createHmac("sha256", this.secret).update(value, "utf8").digest();
  }
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function parseJson(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Token segment must contain an object.");
  }
  return parsed as Record<string, unknown>;
}

function isClaims(
  value: Record<string, unknown>,
): value is Record<string, unknown> & AccessTokenClaims {
  return (
    typeof value.aud === "string" &&
    typeof value.exp === "number" &&
    Number.isInteger(value.exp) &&
    typeof value.iat === "number" &&
    Number.isInteger(value.iat) &&
    typeof value.iss === "string" &&
    typeof value.membershipId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.sub === "string" &&
    typeof value.tenantId === "string"
  );
}
