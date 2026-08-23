import { createLilyHttpClient } from "@lily_platform/lily_ui/http";

import { resolveApiBaseUrl } from "./apiBaseUrl";
import { mapApiProblemError } from "./apiProblemContract";

const configuredApiBaseUrl: unknown = import.meta.env.VITE_API_BASE_URL;

export const appHttpClient = createLilyHttpClient({
  baseURL: resolveApiBaseUrl(
    typeof configuredApiBaseUrl === "string" ? configuredApiBaseUrl : undefined,
  ),
  credentials: "include",
  defaultHeaders: { Accept: "application/json" },
  mapApiError: mapApiProblemError,
  timeoutMs: 10_000,
});
