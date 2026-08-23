import { LilyValidationError } from "@lily_platform/lily_ui/errors";

const TEST_FALLBACK_ORIGIN = "http://127.0.0.1:8080";

export function resolveApiBaseUrl(value: string | undefined, origin?: string): string {
  const runtimeOrigin = origin ?? globalThis.location?.origin ?? TEST_FALLBACK_ORIGIN;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value?.trim() || runtimeOrigin, runtimeOrigin);
  } catch (cause) {
    throw new LilyValidationError({
      code: "Helpdesk.Api.InvalidBaseUrl",
      message: "Helpdesk API base URL is invalid.",
      cause,
    });
  }

  if (
    (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new LilyValidationError({
      code: "Helpdesk.Api.UnsafeBaseUrl",
      message: "Helpdesk API base URL must be a credential-free HTTP(S) URL.",
    });
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";
  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/+$/u, "")}/`;
  return parsedUrl.toString();
}
