import { BadRequestException } from "@nestjs/common";

import { isTenantRole, type TenantRole } from "../domain/permissions.js";

export interface LoginInput {
  readonly email: string;
  readonly password: string;
  readonly tenantId: string | null;
}

export function decodeLoginInput(body: unknown): LoginInput {
  const value = requireRecord(body);
  const email = normalizeEmail(value.email);
  const password = requireString(value.password, "password", 1, 256);
  const tenantId =
    value.tenantId === null || value.tenantId === undefined ? null : requireUuid(value.tenantId);
  return { email, password, tenantId };
}

export function decodeTenantSwitchInput(body: unknown): { readonly tenantId: string } {
  const value = requireRecord(body);
  return { tenantId: requireUuid(value.tenantId) };
}

export function decodeRoleInput(body: unknown): { readonly role: TenantRole } {
  const value = requireRecord(body);
  if (!isTenantRole(value.role)) throw new BadRequestException("role is invalid.");
  return { role: value.role };
}

export function decodeStatusInput(body: unknown): { readonly status: "ACTIVE" | "DISABLED" } {
  const value = requireRecord(body);
  if (value.status !== "ACTIVE" && value.status !== "DISABLED") {
    throw new BadRequestException("status is invalid.");
  }
  return { status: value.status };
}

export function normalizeEmail(value: unknown): string {
  const email = requireString(value, "email", 3, 254).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException("email is invalid.");
  }
  return email;
}

export function requireUuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new BadRequestException("identifier is invalid.");
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("request body must be an object.");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, name: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new BadRequestException(`${name} is required.`);
  const length = Buffer.byteLength(value, "utf8");
  if (length < minimum || length > maximum) {
    throw new BadRequestException(`${name} has an invalid length.`);
  }
  return value;
}
