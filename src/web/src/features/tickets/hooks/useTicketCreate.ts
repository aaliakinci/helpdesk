import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { createLilyFormController, type LilyFormBindings } from "@lily_platform/lily_ui/ui/forms";
import { useEffect, useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import { createTicket, listCustomers } from "../api/ticketApi";
import type { CustomerOption } from "../api/ticketContract";
import { createTicketFormDefinition, type CreateTicketFormValues } from "../model/ticketForms";
import { toTicketUiError, type TicketMode, type TicketUiError } from "../model/ticketPresentation";

export function useTicketCreate({ mode }: { readonly mode: TicketMode }) {
  const navigate = useLilyNavigate();
  const { t } = useAppTranslation();
  const [customers, setCustomers] = useState<readonly CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TicketUiError | null>(null);
  const [revision, setRevision] = useState(0);
  const controller = useMemo(() => createLilyFormController<CreateTicketFormValues>(), []);
  const definition = useMemo(() => createTicketFormDefinition(t), [t]);
  const bindings = useMemo<LilyFormBindings<CreateTicketFormValues>>(
    () => ({
      requesterContactId: {
        visible: mode === "staff",
        options: customers.flatMap((customer) =>
          customer.contacts.map((contact) => ({
            id: contact.id,
            label: `${customer.name} — ${contact.displayName} (${contact.email})`,
            value: contact.id,
          })),
        ),
      },
    }),
    [customers, mode],
  );
  const basePath = mode === "requester" ? "/portal" : "/workspace";

  useEffect(() => {
    const request = new AbortController();
    void loadCustomers();
    return () => request.abort();

    async function loadCustomers(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const nextCustomers = mode === "staff" ? await listCustomers(request.signal) : [];
        if (!request.signal.aborted) setCustomers(nextCustomers);
      } catch (cause) {
        if (!request.signal.aborted) setError(toTicketUiError(cause, t, "load"));
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }
  }, [mode, t]);

  async function submit(values: CreateTicketFormValues): Promise<void> {
    if (mode === "staff" && !values.requesterContactId) {
      setError({
        kind: "validation",
        message: t("app:tickets.form.requesterRequired"),
        traceId: null,
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await createTicket({
        description: values.description,
        priority: values.priority,
        requesterContactId: mode === "staff" ? values.requesterContactId : null,
        subject: values.subject,
      });
      setRevision((value) => value + 1);
      await navigate(`${basePath}/tickets/${next.id}`);
    } catch (cause) {
      setError(toTicketUiError(cause, t, "action"));
    } finally {
      setBusy(false);
    }
  }

  return {
    bindings,
    busy,
    controller,
    definition,
    error,
    loading,
    mode,
    revision,
    back: () => void navigate(basePath),
    submit,
  };
}

export type TicketCreateController = ReturnType<typeof useTicketCreate>;
