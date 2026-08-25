import { useCallback, useEffect, useState } from "react";

import { listAuditEntries, type AuditListFilters } from "../api/auditApi";
import type { AuditPage } from "../api/auditContract";

const DEFAULT_FILTERS: AuditListFilters = {
  action: "",
  actorType: null,
  actorUserId: "",
  aggregateType: "",
  from: "",
  page: 1,
  pageSize: 25,
  to: "",
};

export function useAuditLog() {
  const [draft, setDraftState] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pageData, setPageData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      setLoading(true);
      setFailed(false);
      try {
        const nextPage = await listAuditEntries(filters, controller.signal);
        if (!controller.signal.aborted) setPageData(nextPage);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [filters, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  return {
    draft,
    failed,
    filters,
    loading,
    pageData,
    apply: () =>
      setFilters({
        ...draft,
        action: draft.action.trim(),
        actorUserId: draft.actorUserId.trim(),
        aggregateType: draft.aggregateType.trim(),
        page: 1,
      }),
    applyPage: (page: number) => setFilters((value) => ({ ...value, page })),
    applyPageSize: (pageSize: number) => {
      setDraftState((value) => ({ ...value, pageSize }));
      setFilters((value) => ({ ...value, page: 1, pageSize }));
    },
    reload,
    reset: () => {
      setDraftState(DEFAULT_FILTERS);
      setFilters(DEFAULT_FILTERS);
    },
    setDraft: (changes: Partial<AuditListFilters>) =>
      setDraftState((value) => ({ ...value, ...changes })),
  };
}

export type AuditLogController = ReturnType<typeof useAuditLog>;
