import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { LilyForm } from "@lily_platform/lily_ui/ui/forms";

import { useAppTranslation } from "@/i18n";

import type { EligibleQueueMember, QueueMemberStatus, QueueView } from "../api/operationsContract";
import { useQueueMemberForm } from "../hooks/useQueueMemberForm";
import { emptyQueueMemberValues } from "../model/queueForms";

interface QueueCardProps {
  readonly busy: boolean;
  readonly canManage: boolean;
  readonly eligible: readonly EligibleQueueMember[];
  readonly id: string;
  readonly onSetMember: (membershipId: string, status: QueueMemberStatus) => Promise<boolean>;
  readonly onToggle: () => Promise<boolean>;
  readonly queue: QueueView;
}

export function QueueCard({
  busy,
  canManage,
  eligible,
  id,
  onSetMember,
  onToggle,
  queue,
}: QueueCardProps) {
  const { t } = useAppTranslation();
  const memberForm = useQueueMemberForm({ eligible, onSetMember });
  return (
    <Card
      id={id}
      cardTitle={queue.name}
      subheader={queue.description ?? t("app:queues.noDescription")}
      headerAction={
        <Chip
          id={`${id}.status`}
          label={t(`app:queues.status.${queue.status}`)}
          color={queue.status === "ACTIVE" ? "success" : "default"}
        />
      }
    >
      <Stack id={`${id}.content`} spacing={2}>
        <Typography id={`${id}.counts`} component="p">
          {t("app:queues.openTickets")}: {queue.openTicketCount} ·{" "}
          {t("app:queues.unassignedTickets")}: {queue.unassignedTicketCount}
        </Typography>
        <Stack id={`${id}.members`} spacing={1}>
          {queue.members.length === 0 ? (
            <Typography id={`${id}.members.empty`}>{t("app:queues.noMembers")}</Typography>
          ) : (
            queue.members.map((member) => (
              <Stack
                key={member.membershipId}
                id={`${id}.member.${member.membershipId}`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <Chip
                  id={`${id}.member.${member.membershipId}.label`}
                  label={`${member.displayName} — ${t(`app:queues.memberStatus.${member.status}`)}`}
                  variant="outlined"
                />
                {canManage && (
                  <Button
                    id={`${id}.member.${member.membershipId}.toggle`}
                    disabled={busy}
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      void onSetMember(
                        member.membershipId,
                        member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      )
                    }
                  >
                    {t(
                      member.status === "ACTIVE"
                        ? "app:queues.disableMember"
                        : "app:queues.enableMember",
                    )}
                  </Button>
                )}
              </Stack>
            ))
          )}
        </Stack>
        {canManage && (
          <LilyForm
            bindings={memberForm.bindings}
            controller={memberForm.controller}
            definition={memberForm.definition}
            disabled={busy || eligible.length === 0}
            initialValues={emptyQueueMemberValues}
            initialValuesRevision={memberForm.revision}
            instanceId={`${id}.member.form`}
            reinitialize="always"
            onSubmit={memberForm.submit}
          />
        )}
        {canManage && (
          <Button
            id={`${id}.toggle`}
            disabled={busy}
            color={queue.status === "ACTIVE" ? "error" : "primary"}
            variant="outlined"
            onClick={() => void onToggle()}
          >
            {t(queue.status === "ACTIVE" ? "app:queues.disable" : "app:queues.enable")}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
