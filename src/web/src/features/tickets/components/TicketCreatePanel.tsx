import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { LilyForm } from "@lily_platform/lily_ui/ui/forms";

import { useAppTranslation } from "@/i18n";

import { useTicketCreate } from "../hooks/useTicketCreate";
import { emptyCreateTicketValues } from "../model/ticketForms";
import type { TicketMode } from "../model/ticketPresentation";

export function TicketCreatePanel({
  id,
  mode,
}: {
  readonly id: string;
  readonly mode: TicketMode;
}) {
  const { t } = useAppTranslation();
  const create = useTicketCreate({ mode });

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:tickets.form.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t(`app:tickets.form.${mode}Description`)}
        </Typography>
      </Box>
      {create.error && (
        <Alert id={`${id}.error`} severity="error">
          {create.error.message}
        </Alert>
      )}
      {create.loading ? (
        <Alert id={`${id}.loading`} severity="info">
          {t("app:tickets.loading")}
        </Alert>
      ) : (
        <Box id={`${id}.form-wrap`} sx={{ maxWidth: 800 }}>
          <Card id={`${id}.form`} cardTitle={t("app:tickets.form.details")}>
            <LilyForm
              bindings={create.bindings}
              controller={create.controller}
              definition={create.definition}
              disabled={create.busy}
              initialValues={emptyCreateTicketValues}
              initialValuesRevision={create.revision}
              instanceId={`${id}.form.fields`}
              reinitialize="always"
              onSubmit={create.submit}
            />
          </Card>
        </Box>
      )}
      <Box id={`${id}.back-wrap`}>
        <Button id={`${id}.back`} variant="text" onClick={create.back}>
          {t("app:tickets.back")}
        </Button>
      </Box>
    </Stack>
  );
}
