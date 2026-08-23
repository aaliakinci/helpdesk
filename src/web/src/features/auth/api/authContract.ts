import {
  nullableString,
  requireArray,
  requireBoolean,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export interface TenantOption {
  readonly id: string;
  readonly name: string;
  readonly role: TenantRole;
  readonly slug: string;
}

export type TenantRole = "OWNER" | "MANAGER" | "AGENT" | "REQUESTER" | "AUDITOR";

export interface AuthenticatedUser {
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
}

export interface ActiveTenant extends TenantOption {
  readonly permissions: readonly string[];
  readonly timeZone: string;
}

export interface AuthenticationResponse {
  readonly accessToken: string | null;
  readonly accessTokenExpiresAtUtc: string | null;
  readonly activeTenant: ActiveTenant | null;
  readonly requiresTenantSelection: boolean;
  readonly tenants: readonly TenantOption[];
  readonly user: AuthenticatedUser | null;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly tenantId: string | null;
}

const ROLES: readonly TenantRole[] = ["OWNER", "MANAGER", "AGENT", "REQUESTER", "AUDITOR"];

export function decodeAuthenticationResponse(body: unknown): AuthenticationResponse {
  const value = requireRecord(body, "authentication response");
  const response: AuthenticationResponse = {
    accessToken: nullableString(value.accessToken, "accessToken"),
    accessTokenExpiresAtUtc: nullableString(
      value.accessTokenExpiresAtUtc,
      "accessTokenExpiresAtUtc",
    ),
    activeTenant: value.activeTenant === null ? null : decodeActiveTenant(value.activeTenant),
    requiresTenantSelection: requireBoolean(
      value.requiresTenantSelection,
      "requiresTenantSelection",
    ),
    tenants: requireArray(value.tenants, "tenants").map(decodeTenantOption),
    user: value.user === null ? null : decodeUser(value.user),
  };
  if (
    !response.requiresTenantSelection &&
    (!response.accessToken ||
      !response.accessTokenExpiresAtUtc ||
      !response.activeTenant ||
      !response.user)
  ) {
    throw new TypeError("Authenticated response is missing session fields.");
  }
  if (
    response.requiresTenantSelection &&
    (response.accessToken || response.activeTenant || response.user || response.tenants.length < 2)
  ) {
    throw new TypeError("Tenant-selection response is inconsistent.");
  }
  return response;
}

export function decodeTenantOptions(body: unknown): readonly TenantOption[] {
  return requireArray(body, "tenant options").map(decodeTenantOption);
}

function decodeTenantOption(body: unknown): TenantOption {
  const value = requireRecord(body, "tenant option");
  return {
    id: requireString(value.id, "tenant.id"),
    name: requireString(value.name, "tenant.name"),
    role: decodeRole(value.role),
    slug: requireString(value.slug, "tenant.slug"),
  };
}

function decodeActiveTenant(body: unknown): ActiveTenant {
  const value = requireRecord(body, "active tenant");
  return {
    ...decodeTenantOption(body),
    permissions: requireArray(value.permissions, "tenant.permissions").map((permission) =>
      requireString(permission, "permission"),
    ),
    timeZone: requireString(value.timeZone, "tenant.timeZone"),
  };
}

function decodeUser(body: unknown): AuthenticatedUser {
  const value = requireRecord(body, "authenticated user");
  return {
    displayName: requireString(value.displayName, "user.displayName"),
    email: requireString(value.email, "user.email"),
    id: requireString(value.id, "user.id"),
  };
}

function decodeRole(value: unknown): TenantRole {
  if (typeof value !== "string" || !ROLES.includes(value as TenantRole)) {
    throw new TypeError("tenant.role is invalid.");
  }
  return value as TenantRole;
}
