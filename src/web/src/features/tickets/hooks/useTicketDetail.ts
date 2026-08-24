import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/features/auth";
import { listQueues, type QueueView } from "@/features/operations/catalog";
import { useAppTranslation } from "@/i18n";
import { useRealtime } from "@/features/realtime";

import {
  addTicketComment,
  assignTicket,
  changeTicketStatus,
  getTicket,
  reopenTicket,
  roundRobinTicket,
  setTicketQueue,
  takeOverTicket,
  unassignTicket,
} from "../api/ticketApi";
import type { TicketDetail, TicketStatus } from "../api/ticketContract";
import type { ReplyFormValues } from "../model/ticketForms";
import { toTicketUiError, type TicketMode, type TicketUiError } from "../model/ticketPresentation";

export function useTicketDetail({
  mode,
  ticketId,
}: {
  readonly mode: TicketMode;
  readonly ticketId: string;
}) {
  const auth = useAuth();
  const navigate = useLilyNavigate();
  const { locale, t } = useAppTranslation();
  const realtime = useRealtime();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [queues, setQueues] = useState<readonly QueueView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TicketUiError | null>(null);
  const [revision, setRevision] = useState(0);
  const [replyRevision, setReplyRevision] = useState(0);
  const basePath = mode === "requester" ? "/portal" : "/workspace";
  const role = auth.session?.activeTenant?.role;
  const canManageAssignments = role === "OWNER" || role === "MANAGER";
  const canTakeOver = role === "AGENT";
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
        const [nextDetail, nextQueues] = await Promise.all([
          getTicket(ticketId, controller.signal),
          mode === "staff" ? listQueues(controller.signal) : Promise.resolve([]),
        ]);
        if (controller.signal.aborted) return;
        setDetail(nextDetail);
        setQueues(nextQueues);
      } catch (cause) {
        if (!controller.signal.aborted) setError(toTicketUiError(cause, t, "load"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [mode, realtime.eventRevision, realtime.reconciliationRevision, revision, t, ticketId]);

  const perform = useCallback(
    async (action: () => Promise<TicketDetail>): Promise<TicketDetail | null> => {
      setBusy(true);
      setError(null);
      try {
        const next = await action();
        setDetail(next);
        setRevision((value) => value + 1);
        return next;
      } catch (cause) {
        setError(toTicketUiError(cause, t, "action"));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  return {
    basePath,
    busy,
    canManageAssignments,
    canTakeOver,
    detail,
    error,
    loading,
    locale,
    mode,
    queues,
    replyRevision,
    timeZone,
    assign: (queueId: string, membershipId: string) =>
      detail
        ? perform(() =>
            assignTicket(detail.id, {
              assigneeMembershipId: membershipId,
              expectedVersion: detail.version,
              queueId,
            }),
          ).then(() => undefined)
        : Promise.resolve(),
    back: () => void navigate(basePath),
    changeQueue: (queueId: string) =>
      detail
        ? perform(() =>
            setTicketQueue(detail.id, { expectedVersion: detail.version, queueId }),
          ).then(() => undefined)
        : Promise.resolve(),
    changeStatus: (status: TicketStatus) =>
      detail
        ? perform(() =>
            changeTicketStatus(detail.id, { expectedVersion: detail.version, status }),
          ).then(() => undefined)
        : Promise.resolve(),
    comment: async (values: ReplyFormValues) => {
      if (!detail) return;
      const next = await perform(() =>
        addTicketComment(detail.id, {
          body: values.body,
          expectedVersion: detail.version,
          visibility: mode === "requester" ? "PUBLIC" : values.visibility,
        }),
      );
      if (next) setReplyRevision((value) => value + 1);
    },
    openLinked: (linkedTicketId: string) => void navigate(`${basePath}/tickets/${linkedTicketId}`),
    reload: () => setRevision((value) => value + 1),
    reopen: async () => {
      if (!detail) return;
      const next = await perform(() => reopenTicket(detail.id, detail.version));
      if (next && next.id !== detail.id) await navigate(`${basePath}/tickets/${next.id}`);
    },
    roundRobin: (queueId: string) =>
      detail
        ? perform(() =>
            roundRobinTicket(detail.id, { expectedVersion: detail.version, queueId }),
          ).then(() => undefined)
        : Promise.resolve(),
    takeOver: () =>
      detail
        ? perform(() => takeOverTicket(detail.id, detail.version)).then(() => undefined)
        : Promise.resolve(),
    unassign: () =>
      detail
        ? perform(() => unassignTicket(detail.id, detail.version)).then(() => undefined)
        : Promise.resolve(),
  };
}

export type TicketDetailController = ReturnType<typeof useTicketDetail>;
