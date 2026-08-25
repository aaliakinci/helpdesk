import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { TicketDetail } from "../api/ticketContract";
import { useTicketAttachments } from "../hooks/useTicketAttachments";
import type { TicketDetailController } from "../hooks/useTicketDetail";
import { formatTicketDate, type TicketMode } from "../model/ticketPresentation";

export function TicketAttachmentsCard({
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
  const attachments = useTicketAttachments({
    mode,
    onUploaded: ticket.reload,
    ticketId: detail.id,
  });
  const uploadDisabled = detail.status === "CLOSED" || attachments.busyId !== null;
  return (
    <Card id={`${id}.attachments`} cardTitle={t("app:tickets.attachments.title")}>
      <Stack id={`${id}.attachments.content`} spacing={2}>
        {attachments.error && (
          <Alert id={`${id}.attachments.error`} severity="error">
            {attachments.error.message}
          </Alert>
        )}
        {detail.attachments.length === 0 ? (
          <Typography id={`${id}.attachments.empty`} component="p">
            {t("app:tickets.attachments.empty")}
          </Typography>
        ) : (
          <Stack id={`${id}.attachments.list`} spacing={1}>
            {detail.attachments.map((attachment) => (
              <Box
                key={attachment.id}
                id={`${id}.attachments.item.${attachment.id}`}
                sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}
              >
                <Stack
                  id={`${id}.attachments.item.${attachment.id}.row`}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                >
                  <Box id={`${id}.attachments.item.${attachment.id}.copy`}>
                    <Typography
                      id={`${id}.attachments.item.${attachment.id}.name`}
                      component="p"
                      fontWeight={600}
                    >
                      {attachment.fileName}
                    </Typography>
                    <Typography
                      id={`${id}.attachments.item.${attachment.id}.meta`}
                      component="p"
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {formatBytes(attachment.byteSize)} · {attachment.createdBy.displayName} ·{" "}
                      {formatTicketDate(attachment.createdAtUtc, ticket.locale, ticket.timeZone)}
                    </Typography>
                  </Box>
                  <Stack
                    id={`${id}.attachments.item.${attachment.id}.actions`}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    {mode === "staff" && (
                      <Chip
                        id={`${id}.attachments.item.${attachment.id}.visibility`}
                        label={t(
                          `app:tickets.attachments.${attachment.visibility === "INTERNAL" ? "internal" : "public"}`,
                        )}
                        color={attachment.visibility === "INTERNAL" ? "warning" : "success"}
                        variant="outlined"
                      />
                    )}
                    <Button
                      id={`${id}.attachments.item.${attachment.id}.download`}
                      disabled={attachments.busyId !== null}
                      variant="outlined"
                      onClick={() => void attachments.download(attachment)}
                    >
                      {t("app:tickets.attachments.download")}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
        {detail.status !== "CLOSED" && (
          <Stack id={`${id}.attachments.upload`} spacing={1}>
            {mode === "staff" && (
              <Stack
                id={`${id}.attachments.visibility`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <Button
                  id={`${id}.attachments.visibility.public`}
                  aria-pressed={attachments.visibility === "PUBLIC"}
                  variant={attachments.visibility === "PUBLIC" ? "contained" : "outlined"}
                  onClick={() => attachments.setVisibility("PUBLIC")}
                >
                  {t("app:tickets.attachments.public")}
                </Button>
                <Button
                  id={`${id}.attachments.visibility.internal`}
                  aria-pressed={attachments.visibility === "INTERNAL"}
                  color="warning"
                  variant={attachments.visibility === "INTERNAL" ? "contained" : "outlined"}
                  onClick={() => attachments.setVisibility("INTERNAL")}
                >
                  {t("app:tickets.attachments.internal")}
                </Button>
              </Stack>
            )}
            <input
              key={attachments.inputRevision}
              id={`${id}.attachments.file`}
              aria-label={t("app:tickets.attachments.choose")}
              accept=".pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/jpeg,image/png,text/plain"
              disabled={uploadDisabled}
              type="file"
              onChange={(event) => attachments.setFile(event.currentTarget.files?.item(0) ?? null)}
            />
            <Typography
              id={`${id}.attachments.help`}
              component="p"
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {t("app:tickets.attachments.help")}
            </Typography>
            <Button
              id={`${id}.attachments.submit`}
              disabled={uploadDisabled || !attachments.file}
              variant="contained"
              onClick={() => void attachments.upload()}
            >
              {t("app:tickets.attachments.upload")}
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
