import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { TicketDetail, TicketSlaMilestone } from "../api/ticketContract";
import { formatTicketDate } from "../model/ticketPresentation";

export function TicketSlaCard({
  id,
  locale,
  sla,
  timeZone,
}: {
  readonly id: string;
  readonly locale: string;
  readonly sla: TicketDetail["sla"];
  readonly timeZone: string;
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={id} cardTitle={t("app:tickets.sla.title")}>
      {!sla ? (
        <Alert id={`${id}.not-configured`} severity="info">
          {t("app:tickets.sla.notConfigured")}
        </Alert>
      ) : (
        <Stack id={`${id}.content`} spacing={2}>
          <Milestone
            id={`${id}.first-response`}
            label={t("app:sla.firstResponse")}
            locale={locale}
            milestone={sla.firstResponse}
            timeZone={timeZone}
          />
          <Milestone
            id={`${id}.resolution`}
            label={t("app:sla.resolution")}
            locale={locale}
            milestone={sla.resolution}
            timeZone={timeZone}
          />
          {sla.autoCloseAtUtc && (
            <Typography id={`${id}.auto-close`} component="p" variant="body2">
              {t("app:sla.autoCloseAt")}: {formatTicketDate(sla.autoCloseAtUtc, locale, timeZone)}
            </Typography>
          )}
          <Typography id={`${id}.policy-version`} component="p" variant="caption">
            {t("app:sla.policyVersion")}: v{sla.policyVersion} · {t("app:sla.wallClockShort")}
          </Typography>
        </Stack>
      )}
      <Typography id={`${id}.time-zone`} component="p" variant="body2" sx={{ mt: 1 }}>
        {t("app:tickets.context.timeZone")}: {timeZone}
      </Typography>
    </Card>
  );
}

function Milestone({
  id,
  label,
  locale,
  milestone,
  timeZone,
}: {
  readonly id: string;
  readonly label: string;
  readonly locale: string;
  readonly milestone: TicketSlaMilestone;
  readonly timeZone: string;
}) {
  const { t } = useAppTranslation();
  const color =
    milestone.status === "BREACHED"
      ? "error"
      : milestone.status === "APPROACHING"
        ? "warning"
        : milestone.status === "COMPLETED"
          ? "success"
          : "default";
  return (
    <Stack id={id} spacing={0.5}>
      <Stack
        id={`${id}.heading`}
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography id={`${id}.label`} component="h3" variant="subtitle2">
          {label}
        </Typography>
        <Chip
          id={`${id}.status`}
          size="small"
          color={color}
          label={t(`app:sla.status.${milestone.status}`)}
        />
      </Stack>
      <Typography id={`${id}.due`} component="p" variant="body2">
        {t("app:sla.dueAt")}: {formatTicketDate(milestone.dueAtUtc, locale, timeZone)}
      </Typography>
      {milestone.completedAtUtc && (
        <Typography id={`${id}.completed`} component="p" variant="caption">
          {t("app:sla.completedAt")}: {formatTicketDate(milestone.completedAtUtc, locale, timeZone)}
        </Typography>
      )}
    </Stack>
  );
}
