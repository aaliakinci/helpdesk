import { createLilyHttpClient } from "@lily_platform/lily_ui/http";

import { resolveApiBaseUrl } from "./apiBaseUrl";
import { mapApiProblemError } from "./apiProblemContract";

interface HttpAuthenticationConfiguration {
  readonly getAccessToken: () => string | null;
  readonly onSessionExpired: () => void;
  readonly refresh: () => Promise<void>;
}

const configuredApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;
let authentication: HttpAuthenticationConfiguration | null = null;
let recoveryRefreshPromise: Promise<void> | null = null;

export function configureHttpAuthentication(configuration: HttpAuthenticationConfiguration): void {
  authentication = configuration;
}

export const appHttpClient = createLilyHttpClient({
  baseURL: resolveApiBaseUrl(
    typeof configuredApiBaseUrl === "string" ? configuredApiBaseUrl : undefined,
  ),
  credentials: "include",
  defaultHeaders: { Accept: "application/json" },
  mapApiError: mapApiProblemError,
  timeoutMs: 10_000,
  credentialProvider: {
    getAccessToken: () => authentication?.getAccessToken() ?? null,
  },
  authRecovery: {
    shouldRecover: ({ status }) => status === 401 && authentication !== null,
    refresh: async () => {
      if (!authentication) throw new Error("HTTP authentication has not been configured.");
      recoveryRefreshPromise ??= authentication.refresh().finally(() => {
        recoveryRefreshPromise = null;
      });
      await recoveryRefreshPromise;
    },
    onSessionExpired: () => authentication?.onSessionExpired(),
  },
});
