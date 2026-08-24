import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { useCallback, useEffect, useState } from "react";

import { useRealtime } from "@/features/realtime";
import { useAppTranslation } from "@/i18n";

import { getDashboard, listAgentWorkload } from "../api/operationsApi";
import type { AgentWorkload, OperationsDashboard } from "../api/operationsContract";

export function useOperationsDashboard() {
  const navigate = useLilyNavigate();
  const realtime = useRealtime();
  const { t } = useAppTranslation();
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [workload, setWorkload] = useState<readonly AgentWorkload[]>([]);
  const [loading, setLoading] = useState(true);
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
        const [nextDashboard, nextWorkload] = await Promise.all([
          getDashboard(controller.signal),
          listAgentWorkload(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setDashboard(nextDashboard);
        setWorkload(nextWorkload);
      } catch {
        if (!controller.signal.aborted) setError(t("app:operations.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [realtime.eventRevision, realtime.reconciliationRevision, revision, t]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    dashboard,
    error,
    loading,
    openTicket: (ticketId: string) => navigate(`/workspace/tickets/${ticketId}`),
    reload,
    workload,
  };
}

export type OperationsDashboardController = ReturnType<typeof useOperationsDashboard>;
