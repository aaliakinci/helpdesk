import { useCallback, useEffect, useState } from "react";

import { useRealtime } from "@/features/realtime";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/notificationApi";
import type { NotificationPage } from "../api/notificationContract";

const EMPTY: NotificationPage = { items: [], unreadCount: 0 };

export function useNotifications() {
  const realtime = useRealtime();
  const [page, setPage] = useState<NotificationPage>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      try {
        const next = await listNotifications(controller.signal);
        if (!controller.signal.aborted) {
          setPage(next);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [realtime.eventRevision, realtime.reconciliationRevision, revision]);

  const perform = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setRevision((value) => value + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    error,
    items: page.items,
    loading,
    unreadCount: page.unreadCount,
    markAllRead: () => perform(markAllNotificationsRead),
    markRead: (notificationId: string) => perform(() => markNotificationRead(notificationId)),
    reload: () => setRevision((value) => value + 1),
  };
}

export type NotificationsController = ReturnType<typeof useNotifications>;
