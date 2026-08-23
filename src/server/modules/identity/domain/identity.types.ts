import type { Permission, TenantRole } from "./permissions.js";

export interface AuthenticatedIdentity {
  readonly customerContactId: string | null;
  readonly displayName: string;
  readonly email: string;
  readonly membershipId: string;
  readonly permissions: readonly Permission[];
  readonly role: TenantRole;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly tenantSlug: string;
  readonly tenantTimeZone: string;
  readonly userId: string;
}

export interface TenantOption {
  readonly id: string;
  readonly name: string;
  readonly role: TenantRole;
  readonly slug: string;
}

export interface AuthenticationResponse {
  readonly accessToken: string | null;
  readonly accessTokenExpiresAtUtc: string | null;
  readonly activeTenant: {
    readonly id: string;
    readonly name: string;
    readonly permissions: readonly Permission[];
    readonly role: TenantRole;
    readonly slug: string;
    readonly timeZone: string;
  } | null;
  readonly requiresTenantSelection: boolean;
  readonly tenants: readonly TenantOption[];
  readonly user: {
    readonly displayName: string;
    readonly email: string;
    readonly id: string;
  } | null;
}

export interface AuthenticationEnvelope {
  readonly body: AuthenticationResponse;
  readonly refreshExpiresAt: Date | null;
  readonly refreshToken: string | null;
}
