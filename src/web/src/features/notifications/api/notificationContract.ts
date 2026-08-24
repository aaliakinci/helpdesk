import {
  nullableString,
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export interface NotificationItem {
  readonly createdAtUtc: string;
  readonly dueAtUtc: string | null;
  readonly id: string;
  readonly kind: string;
  readonly milestone: "FIRST_RESPONSE" | "RESOLUTION" | null;
  readonly readAtUtc: string | null;
  readonly subject: string | null;
  readonly ticketId: string | null;
  readonly ticketNumber: number | null;
  readonly warningStage: "APPROACHING" | "BREACHED" | null;
}

export interface NotificationPage {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}

export function decodeNotificationPage(value: unknown): NotificationPage {
  const page = requireRecord(value, "notification page");
  return {
    items: requireArray(page.items, "notification items").map((item) => {
      const notification = requireRecord(item, "notification");
      return {
        createdAtUtc: requireString(notification.createdAtUtc, "notification.createdAtUtc"),
        dueAtUtc: nullableString(notification.dueAtUtc, "notification.dueAtUtc"),
        id: requireString(notification.id, "notification.id"),
        kind: requireString(notification.kind, "notification.kind"),
        milestone: decodeMilestone(notification.milestone),
        readAtUtc: nullableString(notification.readAtUtc, "notification.readAtUtc"),
        subject: nullableString(notification.subject, "notification.subject"),
        ticketId: nullableString(notification.ticketId, "notification.ticketId"),
        ticketNumber:
          notification.ticketNumber === null
            ? null
            : requireNumber(notification.ticketNumber, "notification.ticketNumber"),
        warningStage: decodeWarningStage(notification.warningStage),
      };
    }),
    unreadCount: requireNumber(page.unreadCount, "notification unreadCount"),
  };
}

function decodeMilestone(value: unknown): "FIRST_RESPONSE" | "RESOLUTION" | null {
  if (value === null) return null;
  if (value !== "FIRST_RESPONSE" && value !== "RESOLUTION") {
    throw new TypeError("notification.milestone is invalid.");
  }
  return value;
}

function decodeWarningStage(value: unknown): "APPROACHING" | "BREACHED" | null {
  if (value === null) return null;
  if (value !== "APPROACHING" && value !== "BREACHED") {
    throw new TypeError("notification.warningStage is invalid.");
  }
  return value;
}

export function decodeUpdated(value: unknown): boolean {
  const response = requireRecord(value, "notification update");
  if (response.updated !== true) throw new TypeError("notification update is invalid.");
  return true;
}

export function decodeUpdatedCount(value: unknown): number {
  const response = requireRecord(value, "notification bulk update");
  return requireNumber(response.updatedCount, "notification updatedCount");
}
