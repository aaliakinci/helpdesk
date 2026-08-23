import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
const ALGORITHM = "scrypt";
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_BYTES = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

@Injectable()
export class PasswordHasher {
  public async hash(password: string): Promise<string> {
    validatePassword(password);
    const salt = randomBytes(16);
    const derived = await derive(password, salt);
    return [
      ALGORITHM,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString("base64url"),
      derived.toString("base64url"),
    ].join("$");
  }

  public async verify(password: string, encodedHash: string): Promise<boolean> {
    const parts = encodedHash.split("$");
    if (
      parts.length !== 6 ||
      parts[0] !== ALGORITHM ||
      Number(parts[1]) !== COST ||
      Number(parts[2]) !== BLOCK_SIZE ||
      Number(parts[3]) !== PARALLELIZATION
    ) {
      return false;
    }

    try {
      const salt = Buffer.from(parts[4] ?? "", "base64url");
      const expected = Buffer.from(parts[5] ?? "", "base64url");
      if (salt.length !== 16 || expected.length !== KEY_BYTES) return false;
      const actual = await derive(password, salt);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_BYTES,
      { N: COST, maxmem: MAX_MEMORY, p: PARALLELIZATION, r: BLOCK_SIZE },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function validatePassword(password: string): void {
  const length = Buffer.byteLength(password, "utf8");
  if (length < 12 || length > 256) {
    throw new Error("Passwords must contain between 12 and 256 UTF-8 bytes.");
  }
}
