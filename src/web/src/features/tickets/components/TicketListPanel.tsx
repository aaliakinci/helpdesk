import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useTicketList } from "../hooks/useTicketList";
import type { TicketMode } from "../model/ticketPresentation";
import { TicketFilters } from "./TicketFilters";
import { TicketTable } from "./TicketTable";

export function TicketListPanel({ id, mode }: { readonly id: string; readonly mode: TicketMode }) {
  const { t } = useAppTranslation();
  const list = useTicketList({ mode });
  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h2" variant="h4">
          {t("app:tickets.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t(`app:tickets.${mode}.description`)}
        </Typography>
      </Box>
      {list.error && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {list.error.message}
            </Typography>
            {list.error.traceId && (
              <Typography id={`${id}.error.trace`} component="p" variant="body2">
                {t("app:tickets.errors.traceId")}: {list.error.traceId}
              </Typography>
            )}
            <Button id={`${id}.error.retry`} size="small" variant="outlined" onClick={list.reload}>
              {t("app:tickets.errors.retry")}
            </Button>
          </Stack>
        </Alert>
      )}
      <TicketFilters id={id} list={list} mode={mode} />
      <TicketTable id={id} list={list} />
    </Stack>
  );
}
