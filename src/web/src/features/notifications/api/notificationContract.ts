import {
  nullableString,
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export interface NotificationItem {
  readonly createdAtUtc: string;
  readonly id: string;
  readonly kind: string;
  readonly readAtUtc: string | null;
  readonly subject: string | null;
  readonly ticketId: string | null;
  readonly ticketNumber: number | null;
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
        id: requireString(notification.id, "notification.id"),
        kind: requireString(notification.kind, "notification.kind"),
        readAtUtc: nullableString(notification.readAtUtc, "notification.readAtUtc"),
        subject: nullableString(notification.subject, "notification.subject"),
        ticketId: nullableString(notification.ticketId, "notification.ticketId"),
        ticketNumber:
          notification.ticketNumber === null
            ? null
            : requireNumber(notification.ticketNumber, "notification.ticketNumber"),
      };
    }),
    unreadCount: requireNumber(page.unreadCount, "notification unreadCount"),
  };
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
