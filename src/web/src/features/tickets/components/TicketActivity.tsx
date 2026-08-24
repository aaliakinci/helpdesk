import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { TicketDetail } from "../api/ticketContract";
import type { TicketDetailController } from "../hooks/useTicketDetail";
import { formatTicketDate, type TicketMode } from "../model/ticketPresentation";

export function TicketActivity({
  detail,
  id,
  mode,
  ticket,
}: {
  readonly detail: TicketDetail;
  readonly id: string;
  readonly mode: TicketMode;
  readonly ticket: TicketDetailController;
}) {
  const { t } = useAppTranslation();
  const formatDate = (value: string) => formatTicketDate(value, ticket.locale, ticket.timeZone);
  return (
    <>
      <Box id={`${id}.timeline`}>
        <Typography id={`${id}.timeline.title`} component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("app:tickets.timeline")}
        </Typography>
        <Stack
          id={`${id}.comments`}
          component="ol"
          spacing={2}
          sx={{ listStyle: "none", m: 0, p: 0 }}
        >
          {detail.comments.length === 0 && (
            <Alert id={`${id}.comments.empty`} severity="info">
              {t("app:tickets.noComments")}
            </Alert>
          )}
          {detail.comments.map((comment) => (
            <Card
              key={comment.id}
              id={`${id}.comment.${comment.id}`}
              component="li"
              cardTitle={comment.author.displayName}
              subheader={formatDate(comment.createdAtUtc)}
              {...(comment.visibility === "INTERNAL"
                ? { sx: { border: 2, borderColor: "warning.main", bgcolor: "action.hover" } }
                : { sx: { borderLeft: 4, borderColor: "success.main" } })}
              headerAction={
                <Chip
                  id={`${id}.comment.${comment.id}.visibility`}
                  size="small"
                  color={comment.visibility === "INTERNAL" ? "warning" : "success"}
                  label={t(
                    `app:tickets.reply.${comment.visibility === "INTERNAL" ? "internal" : "public"}`,
                  )}
                />
              }
            >
              <Typography
                id={`${id}.comment.${comment.id}.body`}
                component="p"
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {comment.body}
              </Typography>
            </Card>
          ))}
        </Stack>
      </Box>
      {mode === "staff" && detail.assignmentHistory.length > 0 && (
        <Box id={`${id}.assignment-history`}>
          <Typography
            id={`${id}.assignment-history.title`}
            component="h2"
            variant="h5"
            sx={{ mb: 2 }}
          >
            {t("app:tickets.assignment.history")}
          </Typography>
          <Stack id={`${id}.assignment-history.items`} spacing={1}>
            {detail.assignmentHistory.map((entry) => (
              <Card
                key={entry.id}
                id={`${id}.assignment-history.${entry.id}`}
                cardTitle={t(`app:tickets.assignment.action.${entry.action}`)}
                subheader={`${entry.actor.displayName} · ${formatDate(entry.occurredAtUtc)}`}
              >
                <Typography id={`${id}.assignment-history.${entry.id}.change`} component="p">
                  {entry.fromQueue?.name ?? "—"} / {entry.fromAssignee?.displayName ?? "—"} →{" "}
                  {entry.toQueue?.name ?? "—"} / {entry.toAssignee?.displayName ?? "—"}
                </Typography>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
      {mode === "staff" && detail.statusHistory.length > 0 && (
        <Box id={`${id}.status-history`}>
          <Typography id={`${id}.status-history.title`} component="h2" variant="h5" sx={{ mb: 2 }}>
            {t("app:tickets.statusHistory")}
          </Typography>
          <Stack id={`${id}.status-history.items`} spacing={1}>
            {detail.statusHistory.map((entry) => (
              <Card
                key={entry.id}
                id={`${id}.status-history.${entry.id}`}
                cardTitle={`${entry.fromStatus ? t(`app:tickets.status.${entry.fromStatus}`) : "—"} → ${t(`app:tickets.status.${entry.toStatus}`)}`}
                subheader={`${entry.actor.displayName} · ${formatDate(entry.occurredAtUtc)}`}
              >
                <Typography
                  id={`${id}.status-history.${entry.id}.version`}
                  component="p"
                  variant="body2"
                >
                  v{entry.version}
                </Typography>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
      {(detail.reopenedFrom || detail.reopenedTickets.length > 0) && (
        <Card id={`${id}.linked`} cardTitle={t("app:tickets.linked.title")}>
          <Stack id={`${id}.linked.items`} direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {detail.reopenedFrom && (
              <Button
                id={`${id}.linked.from`}
                variant="outlined"
                onClick={() => ticket.openLinked(detail.reopenedFrom?.id ?? "")}
              >
                {t("app:tickets.linked.previous")} #{detail.reopenedFrom.number}
              </Button>
            )}
            {detail.reopenedTickets.map((linkedTicket) => (
              <Button
                key={linkedTicket.id}
                id={`${id}.linked.${linkedTicket.id}`}
                variant="outlined"
                onClick={() => ticket.openLinked(linkedTicket.id)}
              >
                {t("app:tickets.linked.reopened")} #{linkedTicket.number}
              </Button>
            ))}
          </Stack>
        </Card>
      )}
    </>
  );
}
