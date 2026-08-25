import { useCallback, useState } from "react";

import { useAppTranslation } from "@/i18n";

import { downloadTicketAttachment, uploadTicketAttachment } from "../api/ticketApi";
import type { TicketAttachment, TicketCommentVisibility } from "../api/ticketContract";
import { toTicketUiError, type TicketMode, type TicketUiError } from "../model/ticketPresentation";

export function useTicketAttachments({
  mode,
  onUploaded,
  ticketId,
}: {
  readonly mode: TicketMode;
  readonly onUploaded: () => void;
  readonly ticketId: string;
}) {
  const { t } = useAppTranslation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<TicketUiError | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inputRevision, setInputRevision] = useState(0);
  const [visibility, setVisibilityState] = useState<TicketCommentVisibility>("PUBLIC");

  const setVisibility = useCallback(
    (next: TicketCommentVisibility) => {
      setVisibilityState(mode === "requester" ? "PUBLIC" : next);
    },
    [mode],
  );

  const upload = useCallback(async () => {
    if (!file) return;
    setBusyId("upload");
    setError(null);
    try {
      await uploadTicketAttachment(ticketId, file, mode === "requester" ? "PUBLIC" : visibility);
      setFile(null);
      setInputRevision((value) => value + 1);
      onUploaded();
    } catch (cause) {
      setError(toTicketUiError(cause, t, "attachment"));
    } finally {
      setBusyId(null);
    }
  }, [file, mode, onUploaded, t, ticketId, visibility]);

  const download = useCallback(
    async (attachment: TicketAttachment) => {
      setBusyId(attachment.id);
      setError(null);
      try {
        const blob = await downloadTicketAttachment(attachment.id);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = attachment.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (cause) {
        setError(toTicketUiError(cause, t, "attachment"));
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  return {
    busyId,
    download,
    error,
    file,
    inputRevision,
    setFile,
    setVisibility,
    upload,
    visibility,
  };
}
