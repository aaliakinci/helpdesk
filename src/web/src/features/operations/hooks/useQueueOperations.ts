import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/features/auth";
import { useAppTranslation } from "@/i18n";
import { useRealtime } from "@/features/realtime";

import {
  createQueue,
  listEligibleMembers,
  listQueues,
  setQueueMember,
  updateQueue,
} from "../api/operationsApi";
import type { EligibleQueueMember, QueueMemberStatus, QueueView } from "../api/operationsContract";
import type { CreateQueueFormValues } from "../model/queueForms";

export function useQueueOperations() {
  const auth = useAuth();
  const { t } = useAppTranslation();
  const realtime = useRealtime();
  const role = auth.session?.activeTenant?.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [queues, setQueues] = useState<readonly QueueView[]>([]);
  const [eligible, setEligible] = useState<readonly EligibleQueueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const [nextQueues, nextEligible] = await Promise.all([
          listQueues(controller.signal),
          canManage ? listEligibleMembers(controller.signal) : Promise.resolve([]),
        ]);
        if (controller.signal.aborted) return;
        setQueues(nextQueues);
        setEligible(nextEligible);
      } catch {
        if (!controller.signal.aborted) setError(t("app:queues.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [canManage, realtime.eventRevision, realtime.reconciliationRevision, revision, t]);

  const perform = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await action();
        setRevision((value) => value + 1);
        return true;
      } catch {
        setError(t("app:queues.actionError"));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  return {
    busy,
    canManage,
    eligible,
    error,
    loading,
    queues,
    create: (values: CreateQueueFormValues) =>
      perform(() =>
        createQueue({
          description: values.description.trim() || null,
          name: values.name.trim(),
        }),
      ),
    setMember: (queue: QueueView, membershipId: string, status: QueueMemberStatus) =>
      perform(() =>
        setQueueMember(queue.id, {
          expectedVersion: queue.version,
          membershipId,
          status,
        }),
      ),
    toggle: (queue: QueueView) =>
      perform(() =>
        updateQueue(queue.id, {
          description: queue.description,
          expectedVersion: queue.version,
          name: queue.name,
          status: queue.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
        }),
      ),
  };
}

export type QueueOperationsController = ReturnType<typeof useQueueOperations>;
