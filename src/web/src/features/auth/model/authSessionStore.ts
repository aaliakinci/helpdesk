import type {
  ActiveTenant,
  AuthenticatedUser,
  AuthenticationResponse,
  TenantOption,
} from "../api/authContract";

export interface AuthSession {
  readonly accessToken: string;
  readonly accessTokenExpiresAtUtc: string;
  readonly activeTenant: ActiveTenant;
  readonly tenants: readonly TenantOption[];
  readonly user: AuthenticatedUser;
}

export interface AuthSnapshot {
  readonly initialized: boolean;
  readonly session: AuthSession | null;
}

let snapshot: AuthSnapshot = { initialized: false, session: null };
const listeners = new Set<() => void>();

export const authSessionStore = {
  getAccessToken: (): string | null => snapshot.session?.accessToken ?? null,
  getSnapshot: (): AuthSnapshot => snapshot,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setAuthentication: (response: AuthenticationResponse): void => {
    if (
      response.requiresTenantSelection ||
      !response.accessToken ||
      !response.accessTokenExpiresAtUtc ||
      !response.activeTenant ||
      !response.user
    ) {
      throw new TypeError("Tenant-selection response cannot initialize a session.");
    }
    update({
      initialized: true,
      session: {
        accessToken: response.accessToken,
        accessTokenExpiresAtUtc: response.accessTokenExpiresAtUtc,
        activeTenant: response.activeTenant,
        tenants: response.tenants,
        user: response.user,
      },
    });
  },
  clear: (): void => update({ initialized: true, session: null }),
  markInitialized: (): void => update({ ...snapshot, initialized: true }),
};

function update(next: AuthSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
