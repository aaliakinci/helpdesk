import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { NotificationsController } from "../hooks/useNotifications";

export function NotificationCenter({
  controller,
  id,
}: {
  readonly controller: NotificationsController;
  readonly id: string;
}) {
  const navigate = useLilyNavigate();
  const { locale, t } = useAppTranslation();

  if (controller.loading && controller.items.length === 0) {
    return (
      <Alert id={`${id}.loading`} severity="info">
        {t("app:shell.notificationsLoading")}
      </Alert>
    );
  }
  if (controller.error && controller.items.length === 0) {
    return (
      <Alert
        id={`${id}.error`}
        severity="error"
        action={
          <Button id={`${id}.retry`} onClick={controller.reload}>
            {t("app:shell.retry")}
          </Button>
        }
      >
        {t("app:shell.notificationsError")}
      </Alert>
    );
  }
  if (controller.items.length === 0) {
    return (
      <Alert id={`${id}.empty`} severity="info">
        {t("app:shell.noNotifications")}
      </Alert>
    );
  }

  return (
    <Stack id={id} spacing={1}>
      {controller.unreadCount > 0 && (
        <Button
          id={`${id}.mark-all-read`}
          size="small"
          disabled={controller.busy}
          onClick={() => void controller.markAllRead()}
          sx={{ alignSelf: "flex-end" }}
        >
          {t("app:shell.markAllRead")}
        </Button>
      )}
      {controller.items.map((notification) => (
        <Box
          key={notification.id}
          id={`${id}.${notification.id}`}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}
        >
          <Stack
            id={`${id}.${notification.id}.content`}
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ alignItems: "start" }}
          >
            <Box id={`${id}.${notification.id}.summary`} sx={{ flex: 1 }}>
              <Typography
                id={`${id}.${notification.id}.title`}
                component="p"
                variant="body2"
                sx={{ fontWeight: notification.readAtUtc ? 400 : 700 }}
              >
                {notification.ticketNumber
                  ? `#${notification.ticketNumber} ${notificationTitle(notification, t)}`
                  : notification.kind}
              </Typography>
              {notification.subject && (
                <Typography
                  id={`${id}.${notification.id}.subject`}
                  component="p"
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                >
                  {notification.subject}
                </Typography>
              )}
              <Typography
                id={`${id}.${notification.id}.created-at`}
                component="time"
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(notification.createdAtUtc),
                )}
              </Typography>
            </Box>
            {!notification.readAtUtc && (
              <Button
                id={`${id}.${notification.id}.mark-read`}
                size="small"
                disabled={controller.busy}
                onClick={() => void controller.markRead(notification.id)}
              >
                {t("app:shell.markRead")}
              </Button>
            )}
            {notification.ticketId && (
              <Button
                id={`${id}.${notification.id}.open-ticket`}
                size="small"
                onClick={() => void navigate(`/workspace/tickets/${notification.ticketId}`)}
              >
                {t("app:shell.openTicket")}
              </Button>
            )}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function notificationTitle(
  notification: NotificationsController["items"][number],
  t: (key: string) => string,
): string {
  if (notification.kind === "TICKET_SLA_APPROACHING" && notification.milestone) {
    return t(`app:shell.slaNotification.${notification.milestone}.APPROACHING`);
  }
  if (notification.kind === "TICKET_SLA_BREACHED" && notification.milestone) {
    return t(`app:shell.slaNotification.${notification.milestone}.BREACHED`);
  }
  return t("app:shell.assignedNotification");
}
