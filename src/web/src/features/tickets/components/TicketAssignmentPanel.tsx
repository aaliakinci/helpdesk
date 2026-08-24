import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { TicketDetail } from "../api/ticketContract";
import type { TicketDetailController } from "../hooks/useTicketDetail";

export function TicketAssignmentPanel({
  detail,
  id,
  ticket,
}: {
  readonly detail: TicketDetail;
  readonly id: string;
  readonly ticket: TicketDetailController;
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={`${id}.assignment`} cardTitle={t("app:tickets.assignment.title")}>
      <Stack id={`${id}.assignment.content`} spacing={2}>
        <Typography id={`${id}.assignment.current`} component="p">
          {t("app:tickets.assignment.queue")}:{" "}
          {detail.queue?.name ?? t("app:tickets.assignment.noQueue")} ·{" "}
          {t("app:tickets.assignment.assignee")}:{" "}
          {detail.assignee?.displayName ?? t("app:tickets.assignment.unassigned")}
        </Typography>
        {ticket.canTakeOver && detail.queue && (
          <Button
            id={`${id}.assignment.take-over`}
            disabled={ticket.busy}
            variant="contained"
            onClick={() => void ticket.takeOver()}
          >
            {t("app:tickets.assignment.takeOver")}
          </Button>
        )}
        {ticket.canManageAssignments && (
          <Stack id={`${id}.assignment.management`} spacing={2}>
            {detail.assignee && (
              <Button
                id={`${id}.assignment.unassign`}
                disabled={ticket.busy}
                color="warning"
                variant="outlined"
                onClick={() => void ticket.unassign()}
              >
                {t("app:tickets.assignment.unassign")}
              </Button>
            )}
            {ticket.queues
              .filter((queue) => queue.status === "ACTIVE")
              .map((queue) => (
                <Box
                  key={queue.id}
                  id={`${id}.assignment.queue.${queue.id}`}
                  sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}
                >
                  <Typography
                    id={`${id}.assignment.queue.${queue.id}.title`}
                    component="h3"
                    variant="h6"
                  >
                    {queue.name}
                  </Typography>
                  <Stack
                    id={`${id}.assignment.queue.${queue.id}.actions`}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mt: 1, flexWrap: "wrap" }}
                  >
                    <Button
                      id={`${id}.assignment.queue.${queue.id}.place`}
                      disabled={ticket.busy}
                      variant="outlined"
                      onClick={() => void ticket.changeQueue(queue.id)}
                    >
                      {t("app:tickets.assignment.place")}
                    </Button>
                    <Button
                      id={`${id}.assignment.queue.${queue.id}.round-robin`}
                      disabled={ticket.busy || queue.activeMemberCount === 0}
                      variant="outlined"
                      onClick={() => void ticket.roundRobin(queue.id)}
                    >
                      {t("app:tickets.assignment.roundRobin")}
                    </Button>
                    {queue.members
                      .filter((member) => member.status === "ACTIVE")
                      .map((member) => (
                        <Button
                          key={member.membershipId}
                          id={`${id}.assignment.queue.${queue.id}.member.${member.membershipId}`}
                          disabled={ticket.busy}
                          variant="text"
                          onClick={() => void ticket.assign(queue.id, member.membershipId)}
                        >
                          {t("app:tickets.assignment.assignTo")} {member.displayName}
                        </Button>
                      ))}
                  </Stack>
                </Box>
              ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
