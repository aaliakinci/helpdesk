import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";

import { useAppTranslation } from "@/i18n";

import type { TicketDetail } from "../api/ticketContract";
import type { TicketDetailController } from "../hooks/useTicketDetail";
import { ticketStatusTransitions } from "../model/ticketPresentation";

export function TicketWorkflow({
  detail,
  id,
  ticket,
}: {
  readonly detail: TicketDetail;
  readonly id: string;
  readonly ticket: TicketDetailController;
}) {
  const { t } = useAppTranslation();
  const transitions = ticketStatusTransitions[detail.status];
  if (transitions.length === 0 && detail.status !== "RESOLVED" && detail.status !== "CLOSED")
    return null;
  return (
    <Card id={`${id}.workflow`} cardTitle={t("app:tickets.workflow")}>
      <Stack id={`${id}.workflow.actions`} direction={{ xs: "column", sm: "row" }} spacing={1}>
        {transitions.map((status) => (
          <Button
            key={status}
            id={`${id}.status.${status}`}
            disabled={ticket.busy}
            variant="outlined"
            onClick={() => void ticket.changeStatus(status)}
          >
            {t(`app:tickets.status.${status}`)}
          </Button>
        ))}
        {(detail.status === "RESOLVED" || detail.status === "CLOSED") && (
          <Button
            id={`${id}.reopen`}
            disabled={ticket.busy}
            variant="contained"
            onClick={() => void ticket.reopen()}
          >
            {t("app:tickets.reopen")}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
