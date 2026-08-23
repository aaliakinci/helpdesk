import { appHttpClient, configureHttpAuthentication } from "@/shared/api";

import { authSessionStore } from "../model/authSessionStore";
import {
  decodeAuthenticationResponse,
  decodeTenantOptions,
  type AuthenticationResponse,
  type LoginRequest,
  type TenantOption,
} from "./authContract";

export function configureAuthHttpClient(): void {
  configureHttpAuthentication({
    getAccessToken: authSessionStore.getAccessToken,
    onSessionExpired: authSessionStore.clear,
    refresh: async () => {
      await refreshAuthentication();
    },
  });
}

export async function login(request: LoginRequest): Promise<AuthenticationResponse> {
  const response = await appHttpClient.postData<AuthenticationResponse, LoginRequest>(
    "/api/v1/auth/login",
    request,
    {
      decode: decodeAuthenticationResponse,
      metadata: {
        auth: "none",
        authRecovery: "none",
        operationName: "identity.login",
        replay: "deny",
      },
    },
  );
  if (!response.requiresTenantSelection) authSessionStore.setAuthentication(response);
  return response;
}

export async function refreshAuthentication(): Promise<AuthenticationResponse> {
  const response = await appHttpClient.postData<AuthenticationResponse, Record<string, never>>(
    "/api/v1/auth/refresh",
    {},
    {
      decode: decodeAuthenticationResponse,
      metadata: {
        auth: "none",
        authRecovery: "none",
        operationName: "identity.refresh",
        replay: "deny",
      },
    },
  );
  authSessionStore.setAuthentication(response);
  return response;
}

export async function logout(): Promise<void> {
  try {
    await appHttpClient.postData<void, Record<string, never>>(
      "/api/v1/auth/logout",
      {},
      {
        metadata: {
          auth: "none",
          authRecovery: "none",
          operationName: "identity.logout",
          replay: "deny",
        },
      },
    );
  } finally {
    authSessionStore.clear();
  }
}

export async function revokeAllSessions(): Promise<void> {
  try {
    await appHttpClient.postData<void, Record<string, never>>(
      "/api/v1/auth/revoke-all",
      {},
      {
        metadata: { authRecovery: "none", operationName: "identity.revoke-all", replay: "deny" },
      },
    );
  } finally {
    authSessionStore.clear();
  }
}

export async function switchTenant(tenantId: string): Promise<AuthenticationResponse> {
  const response = await appHttpClient.postData<AuthenticationResponse, { tenantId: string }>(
    "/api/v1/auth/switch-tenant",
    { tenantId },
    {
      decode: decodeAuthenticationResponse,
      metadata: { authRecovery: "none", operationName: "identity.switch-tenant", replay: "deny" },
    },
  );
  authSessionStore.setAuthentication(response);
  return response;
}

export function listAvailableTenants(signal?: AbortSignal): Promise<readonly TenantOption[]> {
  return appHttpClient.getData<readonly TenantOption[]>("/api/v1/auth/tenants", {
    decode: decodeTenantOptions,
    metadata: { operationName: "identity.list-tenants" },
    ...(signal ? { signal } : {}),
  });
}
