import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { TextField } from "@lily_platform/lily_ui/ui/atoms/TextField";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useSlaPolicy } from "../hooks/useSlaPolicy";

export function SlaPolicyPanel({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const policy = useSlaPolicy();
  return (
    <Card id={id} cardTitle={t("app:sla.policyTitle")} subheader={t("app:sla.wallClockNotice")}>
      <Stack id={`${id}.content`} spacing={2}>
        {policy.error && (
          <Alert id={`${id}.error`} severity="error">
            {policy.error}
          </Alert>
        )}
        {policy.success && (
          <Alert id={`${id}.success`} severity="success">
            {t("app:sla.saved")}
          </Alert>
        )}
        {policy.loading ? (
          <Typography id={`${id}.loading`}>{t("app:sla.loading")}</Typography>
        ) : (
          <>
            <Box
              id={`${id}.targets`}
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              {policy.priorities.map((priority) => {
                const target = policy.draft.targets[priority];
                return (
                  <Stack key={priority} id={`${id}.${priority}`} spacing={1}>
                    <Typography id={`${id}.${priority}.title`} component="h3" variant="h6">
                      {t(`app:tickets.priority.${priority}`)}
                    </Typography>
                    <TextField
                      id={`${id}.${priority}.first-response`}
                      disabled={!policy.canManage || policy.busy}
                      label={t("app:sla.firstResponseMinutes")}
                      value={target.firstResponseMinutes}
                      inputProps={{ inputMode: "numeric" }}
                      onValueChange={(value) =>
                        policy.setTarget(priority, "firstResponseMinutes", value)
                      }
                    />
                    <TextField
                      id={`${id}.${priority}.resolution`}
                      disabled={!policy.canManage || policy.busy}
                      label={t("app:sla.resolutionMinutes")}
                      value={target.resolutionMinutes}
                      inputProps={{ inputMode: "numeric" }}
                      onValueChange={(value) =>
                        policy.setTarget(priority, "resolutionMinutes", value)
                      }
                    />
                    <TextField
                      id={`${id}.${priority}.approaching`}
                      disabled={!policy.canManage || policy.busy}
                      label={t("app:sla.approachingBeforeMinutes")}
                      value={target.approachingBeforeMinutes}
                      inputProps={{ inputMode: "numeric" }}
                      onValueChange={(value) =>
                        policy.setTarget(priority, "approachingBeforeMinutes", value)
                      }
                    />
                  </Stack>
                );
              })}
            </Box>
            <TextField
              id={`${id}.auto-close`}
              disabled={!policy.canManage || policy.busy}
              fullWidth
              label={t("app:sla.autoCloseMinutes")}
              value={policy.draft.autoCloseResolvedMinutes}
              inputProps={{ inputMode: "numeric" }}
              onValueChange={policy.setAutoCloseResolvedMinutes}
            />
            {policy.canManage ? (
              <Button
                id={`${id}.save`}
                variant="contained"
                disabled={policy.busy}
                onClick={() => void policy.save()}
              >
                {t("app:sla.save")}
              </Button>
            ) : (
              <Alert id={`${id}.read-only`} severity="info">
                {t("app:sla.readOnly")}
              </Alert>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
