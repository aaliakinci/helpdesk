import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";
import { PublicShell } from "@/shared/components";

import type { CheckStatus } from "../api/systemStatusContract";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { StatusCard } from "./StatusCard";

interface SystemStatusFeatureProps {
  readonly id: string;
}

export function SystemStatusFeature({ id }: SystemStatusFeatureProps) {
  const navigate = useLilyNavigate();
  const { changeLocale, locale, t } = useAppTranslation();
  const { reload, state } = useSystemStatus();
  const report = state.kind === "ready" ? state.report : undefined;

  const statusLabel = (status: CheckStatus | undefined): string => {
    if (status === undefined) return t("app:status.checking");
    return status === "up" ? t("app:status.up") : t("app:status.down");
  };

  return (
    <PublicShell
      id={`${id}.shell`}
      brand={t("app:brand")}
      languageLabel={t("app:shell.language")}
      locale={locale}
      onLocaleChange={(nextLocale) => void changeLocale(nextLocale)}
      skipToContentLabel={t("app:shell.skipToContent")}
    >
      <Stack id={`${id}.content`} spacing={4}>
        <Box id={`${id}.heading`}>
          <Typography
            id={`${id}.eyebrow`}
            component="p"
            variant="overline"
            sx={{ color: "secondary.main", fontWeight: 800 }}
          >
            {t("app:status.eyebrow")}
          </Typography>
          <Typography id={`${id}.title`} component="h1" variant="h2" sx={{ mt: 1 }}>
            {t("app:status.title")}
          </Typography>
          <Typography
            id={`${id}.description`}
            component="p"
            sx={{ color: "text.secondary", maxWidth: 720, mt: 2 }}
          >
            {t("app:status.description")}
          </Typography>
        </Box>

        {state.kind === "error" && (
          <Alert id={`${id}.load-error`} severity="error">
            {t("app:status.loadError")}
          </Alert>
        )}
        {report && (
          <Alert id={`${id}.summary`} severity={report.status === "ready" ? "success" : "warning"}>
            {report.status === "ready" ? t("app:status.ready") : t("app:status.notReady")}
          </Alert>
        )}

        <Box
          id={`${id}.cards`}
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          }}
        >
          <StatusCard
            id={`${id}.api`}
            label={t("app:status.api")}
            status={report ? "up" : undefined}
            statusLabel={
              state.kind === "error" ? t("app:status.down") : statusLabel(report ? "up" : undefined)
            }
          />
          {(["postgresql", "rabbitmq", "redis"] as const).map((name) => (
            <StatusCard
              key={name}
              id={`${id}.${name}`}
              label={t(`app:status.${name}`)}
              status={report?.checks[name].status}
              statusLabel={
                state.kind === "error"
                  ? t("app:status.down")
                  : statusLabel(report?.checks[name].status)
              }
              durationMilliseconds={report?.checks[name].durationMilliseconds}
            />
          ))}
        </Box>

        {report && (
          <Stack id={`${id}.metadata`} spacing={0.5}>
            <Typography
              id={`${id}.version`}
              component="p"
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {t("app:status.version")}: {report.version}
            </Typography>
            <Typography
              id={`${id}.checked-at`}
              component="p"
              variant="body2"
              sx={{ color: "text.secondary" }}
            >
              {t("app:status.checkedAt")}:{" "}
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(
                new Date(report.timestamp),
              )}
            </Typography>
            <Typography
              id={`${id}.trace-id`}
              component="p"
              variant="body2"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {t("app:status.traceId")}: {report.traceId}
            </Typography>
          </Stack>
        )}

        <Box id={`${id}.actions`}>
          <Stack id={`${id}.actions.content`} direction="row" spacing={1}>
            <Button
              id={`${id}.retry`}
              variant="outlined"
              disabled={state.kind === "loading"}
              onClick={() => void reload()}
            >
              {state.kind === "loading" ? t("app:status.checking") : t("app:status.retry")}
            </Button>
            <Button id={`${id}.login`} variant="contained" onClick={() => void navigate("/login")}>
              {t("app:navigation.signIn")}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </PublicShell>
  );
}
