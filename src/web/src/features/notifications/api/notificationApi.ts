import { appHttpClient } from "@/shared/api";

import {
  decodeNotificationPage,
  decodeUpdated,
  decodeUpdatedCount,
  type NotificationPage,
} from "./notificationContract";

export function listNotifications(signal?: AbortSignal): Promise<NotificationPage> {
  return appHttpClient.getData<NotificationPage>("/api/v1/notifications", {
    decode: decodeNotificationPage,
    metadata: { operationName: "notifications.list" },
    ...(signal ? { signal } : {}),
  });
}

export function markNotificationRead(notificationId: string): Promise<boolean> {
  return appHttpClient.postData<boolean, Record<string, never>>(
    `/api/v1/notifications/${notificationId}/read`,
    {},
    {
      decode: decodeUpdated,
      metadata: { operationName: "notifications.mark-read", replay: "deny" },
    },
  );
}

export function markAllNotificationsRead(): Promise<number> {
  return appHttpClient.postData<number, Record<string, never>>(
    "/api/v1/notifications/read-all",
    {},
    {
      decode: decodeUpdatedCount,
      metadata: { operationName: "notifications.mark-all-read", replay: "deny" },
    },
  );
}
