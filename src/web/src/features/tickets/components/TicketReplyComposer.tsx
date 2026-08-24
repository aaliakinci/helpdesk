import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Divider } from "@lily_platform/lily_ui/ui/atoms/Divider";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { LilyForm } from "@lily_platform/lily_ui/ui/forms";

import { useAppTranslation } from "@/i18n";

import type { TicketDetailController } from "../hooks/useTicketDetail";
import { useTicketReply } from "../hooks/useTicketReply";
import { emptyReplyValues } from "../model/ticketForms";
import type { TicketMode } from "../model/ticketPresentation";

export function TicketReplyComposer({
  id,
  mode,
  ticket,
}: {
  readonly id: string;
  readonly mode: TicketMode;
  readonly ticket: TicketDetailController;
}) {
  const { t } = useAppTranslation();
  const reply = useTicketReply();
  return (
    <>
      <Divider id={`${id}.reply.divider`} />
      {mode === "staff" && (
        <Stack id={`${id}.reply.mode`} direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            id={`${id}.reply.mode.public`}
            variant={reply.visibility === "PUBLIC" ? "contained" : "outlined"}
            aria-pressed={reply.visibility === "PUBLIC"}
            onClick={() => reply.setVisibility("PUBLIC")}
          >
            {t("app:tickets.reply.public")}
          </Button>
          <Button
            id={`${id}.reply.mode.internal`}
            color="warning"
            variant={reply.visibility === "INTERNAL" ? "contained" : "outlined"}
            aria-pressed={reply.visibility === "INTERNAL"}
            onClick={() => reply.setVisibility("INTERNAL")}
          >
            {t("app:tickets.reply.internal")}
          </Button>
        </Stack>
      )}
      <Card
        id={`${id}.reply`}
        cardTitle={t(
          `app:tickets.reply.${reply.visibility === "INTERNAL" ? "internalTitle" : "publicTitle"}`,
        )}
        sx={
          reply.visibility === "INTERNAL"
            ? { border: 2, borderColor: "warning.main" }
            : { border: 2, borderColor: "success.main" }
        }
      >
        <Alert
          id={`${id}.reply.notice`}
          severity={reply.visibility === "INTERNAL" ? "warning" : "success"}
          sx={{ mb: 2 }}
        >
          {t(
            `app:tickets.reply.${reply.visibility === "INTERNAL" ? "internalNotice" : "publicNotice"}`,
          )}
        </Alert>
        <LilyForm
          controller={reply.controller}
          definition={reply.definition}
          disabled={ticket.busy}
          initialValues={{ ...emptyReplyValues, visibility: reply.visibility }}
          initialValuesRevision={
            ticket.replyRevision * 2 + (reply.visibility === "INTERNAL" ? 1 : 0)
          }
          instanceId={`${id}.reply.form`}
          reinitialize="always"
          onSubmit={ticket.comment}
        />
      </Card>
    </>
  );
}
