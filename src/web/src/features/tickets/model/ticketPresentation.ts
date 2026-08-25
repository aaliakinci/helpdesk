import { LilyApiError, LilyNetworkError, normalizeError } from "@lily_platform/lily_ui/errors";

import type { TicketStatus } from "../api/ticketContract";

export type TicketMode = "requester" | "staff";

export interface TicketUiError {
  readonly kind: "conflict" | "forbidden" | "network" | "unavailable" | "validation" | "unknown";
  readonly message: string;
  readonly traceId: string | null;
}

export const ticketStatusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "PENDING", "RESOLVED"],
  OPEN: ["PENDING", "RESOLVED"],
  PENDING: ["OPEN", "RESOLVED"],
  RESOLVED: [],
  CLOSED: [],
};

export function formatTicketDate(value: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function toTicketUiError(
  cause: unknown,
  t: (key: string) => string,
  operation: "action" | "attachment" | "load",
): TicketUiError {
  const error = normalizeError(cause);
  const traceId = cause instanceof LilyApiError ? (cause.traceId ?? null) : null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { kind: "network", message: t("app:tickets.errors.offline"), traceId };
  }
  if (cause instanceof LilyNetworkError) {
    return { kind: "network", message: t("app:tickets.errors.network"), traceId };
  }
  if (error.statusCode === 409) {
    return { kind: "conflict", message: t("app:tickets.errors.conflict"), traceId };
  }
  if (error.statusCode === 403) {
    return { kind: "forbidden", message: t("app:tickets.errors.forbidden"), traceId };
  }
  if (error.statusCode === 400 || error.statusCode === 422) {
    return { kind: "validation", message: t("app:tickets.errors.validation"), traceId };
  }
  if (error.statusCode === 503 && operation === "attachment") {
    return {
      kind: "unavailable",
      message: t("app:tickets.attachments.unavailable"),
      traceId,
    };
  }
  return {
    kind: "unknown",
    message: t(operation === "load" ? "app:tickets.loadError" : "app:tickets.actionError"),
    traceId,
  };
}
