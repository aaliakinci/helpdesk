import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useTicketDetail } from "../hooks/useTicketDetail";
import { formatTicketDate, type TicketMode } from "../model/ticketPresentation";
import { TicketActivity } from "./TicketActivity";
import { TicketAssignmentPanel } from "./TicketAssignmentPanel";
import { TicketReplyComposer } from "./TicketReplyComposer";
import { TicketWorkflow } from "./TicketWorkflow";

export function TicketDetailPanel({
  id,
  mode,
  ticketId,
}: {
  readonly id: string;
  readonly mode: TicketMode;
  readonly ticketId: string;
}) {
  const { t } = useAppTranslation();
  const ticket = useTicketDetail({ mode, ticketId });
  const detail = ticket.detail;

  if (ticket.loading && !detail)
    return <Typography id={`${id}.loading`}>{t("app:tickets.loading")}</Typography>;
  if (!detail) {
    return (
      <Alert id={`${id}.missing`} severity="error">
        <Stack id={`${id}.missing.content`} spacing={1}>
          <Typography id={`${id}.missing.message`} component="p">
            {ticket.error?.message ?? t("app:tickets.loadError")}
          </Typography>
          <Button id={`${id}.missing.retry`} variant="outlined" onClick={ticket.reload}>
            {t("app:tickets.errors.retry")}
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <Stack id={id} spacing={3}>
      <Stack id={`${id}.navigation`} direction="row" spacing={1}>
        <Button id={`${id}.back`} variant="outlined" onClick={ticket.back}>
          {t("app:tickets.back")}
        </Button>
      </Stack>
      {ticket.error && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {ticket.error.message}
            </Typography>
            {ticket.error.traceId && (
              <Typography id={`${id}.error.trace`} component="p" variant="body2">
                {t("app:tickets.errors.traceId")}: {ticket.error.traceId}
              </Typography>
            )}
            {ticket.error.kind === "conflict" && (
              <Button id={`${id}.error.refresh`} variant="outlined" onClick={ticket.reload}>
                {t("app:tickets.errors.refresh")}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      <Card
        id={`${id}.summary`}
        cardTitle={`#${detail.number} — ${detail.subject}`}
        subheader={`${detail.requester.customerName} / ${detail.requester.displayName}`}
      >
        <Stack id={`${id}.summary.content`} spacing={2}>
          <Stack id={`${id}.badges`} direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              id={`${id}.status`}
              label={t(`app:tickets.status.${detail.status}`)}
              color="primary"
            />
            <Chip
              id={`${id}.priority`}
              label={t(`app:tickets.priority.${detail.priority}`)}
              variant="outlined"
            />
            <Chip id={`${id}.version`} label={`v${detail.version}`} variant="outlined" />
          </Stack>
          <Typography id={`${id}.description`} component="p" sx={{ whiteSpace: "pre-wrap" }}>
            {detail.description}
          </Typography>
          <Typography
            id={`${id}.updated`}
            component="p"
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            {t("app:tickets.updatedAt")}:{" "}
            {formatTicketDate(detail.updatedAtUtc, ticket.locale, ticket.timeZone)}
          </Typography>
        </Stack>
      </Card>
      <Box
        id={`${id}.service-context`}
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Card id={`${id}.ownership`} cardTitle={t("app:tickets.context.title")}>
          <Stack id={`${id}.ownership.content`} spacing={1}>
            <Typography id={`${id}.ownership.queue`} component="p">
              <strong>{t("app:tickets.assignment.queue")}:</strong>{" "}
              {detail.queue?.name ?? t("app:tickets.assignment.noQueue")}
            </Typography>
            <Typography id={`${id}.ownership.assignee`} component="p">
              <strong>{t("app:tickets.assignment.assignee")}:</strong>{" "}
              {detail.assignee?.displayName ?? t("app:tickets.assignment.unassigned")}
            </Typography>
            <Typography id={`${id}.ownership.created`} component="p" variant="body2">
              {t("app:tickets.context.createdAt")}:{" "}
              {formatTicketDate(detail.createdAtUtc, ticket.locale, ticket.timeZone)}
            </Typography>
          </Stack>
        </Card>
        <Card id={`${id}.sla`} cardTitle={t("app:tickets.sla.title")}>
          <Alert id={`${id}.sla.placeholder`} severity="info">
            {t("app:tickets.sla.notConfigured")}
          </Alert>
          <Typography id={`${id}.sla.time-zone`} component="p" variant="body2" sx={{ mt: 1 }}>
            {t("app:tickets.context.timeZone")}: {ticket.timeZone}
          </Typography>
        </Card>
      </Box>
      {mode === "staff" && <TicketAssignmentPanel id={id} detail={detail} ticket={ticket} />}
      {mode === "staff" && <TicketWorkflow id={id} detail={detail} ticket={ticket} />}
      <TicketActivity id={id} detail={detail} mode={mode} ticket={ticket} />
      {detail.status !== "CLOSED" && <TicketReplyComposer id={id} mode={mode} ticket={ticket} />}
      <Box id={`${id}.route-meta`} sx={{ display: "none" }}>
        {ticket.basePath}
      </Box>
    </Stack>
  );
}
