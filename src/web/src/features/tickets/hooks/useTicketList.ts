import { useLilyLocation, useLilyNavigate } from "@lily_platform/lily_ui/router";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth";
import { listQueues, type QueueView } from "@/features/operations/catalog";
import { useAppTranslation } from "@/i18n";
import { useRealtime } from "@/features/realtime";

import { listTickets } from "../api/ticketApi";
import type { TicketPage } from "../api/ticketContract";
import {
  defaultTicketListQuery,
  parseTicketListQuery,
  serializeTicketListQuery,
  type TicketListQuery,
} from "../model/ticketListQuery";
import { toTicketUiError, type TicketMode, type TicketUiError } from "../model/ticketPresentation";

export function useTicketList({ mode }: { readonly mode: TicketMode }) {
  const auth = useAuth();
  const location = useLilyLocation();
  const navigate = useLilyNavigate();
  const { locale, t } = useAppTranslation();
  const realtime = useRealtime();
  const query = useMemo(() => parseTicketListQuery(location.search), [location.search]);
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    source: query.search,
    value: query.search,
  }));
  const searchDraft =
    searchDraftState.source === query.search ? searchDraftState.value : query.search;
  const [pageData, setPageData] = useState<TicketPage | null>(null);
  const [queues, setQueues] = useState<readonly QueueView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TicketUiError | null>(null);
  const [revision, setRevision] = useState(0);
  const basePath = mode === "requester" ? "/portal" : "/workspace";
  const timeZone = auth.session?.activeTenant.timeZone ?? "UTC";

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
        const [tickets, nextQueues] = await Promise.all([
          listTickets(
            {
              ...query,
              assignment: mode === "requester" ? "ALL" : query.assignment,
              queueId: mode === "requester" ? null : query.queueId,
            },
            controller.signal,
          ),
          mode === "staff" ? listQueues(controller.signal) : Promise.resolve([]),
        ]);
        if (controller.signal.aborted) return;
        setPageData(tickets);
        setQueues(nextQueues);
      } catch (cause) {
        if (!controller.signal.aborted) setError(toTicketUiError(cause, t, "load"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [mode, query, realtime.eventRevision, realtime.reconciliationRevision, revision, t]);

  function navigateWithQuery(next: TicketListQuery): void {
    void navigate(
      { pathname: location.pathname, search: serializeTicketListQuery(next) },
      { replace: false },
    );
  }

  return {
    error,
    loading,
    locale,
    mode,
    pageData,
    query,
    queues,
    searchDraft,
    timeZone,
    applyQuery: (changes: Partial<TicketListQuery>) => navigateWithQuery({ ...query, ...changes }),
    applySearch: () =>
      navigateWithQuery({ ...query, page: 1, search: searchDraft.trim().slice(0, 120) }),
    open: (ticketId: string) => void navigate(`${basePath}/tickets/${ticketId}`),
    reload: () => setRevision((value) => value + 1),
    reset: () => {
      setSearchDraftState({ source: "", value: "" });
      navigateWithQuery(defaultTicketListQuery);
    },
    setSearchDraft: (value: string) => setSearchDraftState({ source: query.search, value }),
  };
}

export type TicketListController = ReturnType<typeof useTicketList>;
