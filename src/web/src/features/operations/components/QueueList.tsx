import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { QueueOperationsController } from "../hooks/useQueueOperations";
import { QueueCard } from "./QueueCard";

export function QueueList({
  id,
  operations,
}: {
  readonly id: string;
  readonly operations: QueueOperationsController;
}) {
  const { t } = useAppTranslation();
  return (
    <Stack id={id} spacing={2}>
      <Typography id={`${id}.title`} component="h2" variant="h5">
        {t("app:queues.listTitle")}
      </Typography>
      {operations.loading && operations.queues.length === 0 ? (
        <Typography id={`${id}.loading`}>{t("app:queues.loading")}</Typography>
      ) : operations.queues.length === 0 ? (
        <Alert id={`${id}.empty`} severity="info">
          {t("app:queues.empty")}
        </Alert>
      ) : (
        <Stack id={`${id}.items`} spacing={2}>
          {operations.queues.map((queue) => (
            <QueueCard
              key={queue.id}
              busy={operations.busy}
              canManage={operations.canManage}
              eligible={operations.eligible}
              id={`${id.replace(/\.queues$/u, "")}.queue.${queue.id}`}
              queue={queue}
              onSetMember={(membershipId, status) =>
                operations.setMember(queue, membershipId, status)
              }
              onToggle={() => operations.toggle(queue)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
