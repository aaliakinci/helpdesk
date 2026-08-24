import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { AgentWorkload } from "../api/operationsContract";

export function AgentWorkloadCard({
  id,
  workload,
}: {
  readonly id: string;
  readonly workload: readonly AgentWorkload[];
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={id} cardTitle={t("app:queues.workload.title")}>
      <Stack id={`${id}.items`} spacing={1}>
        {workload.length === 0 ? (
          <Typography id={`${id}.empty`}>{t("app:queues.workload.empty")}</Typography>
        ) : (
          workload.map((agent) => (
            <Stack
              key={agent.membershipId}
              id={`${id}.${agent.membershipId}`}
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography id={`${id}.${agent.membershipId}.name`} component="span">
                {agent.displayName}
              </Typography>
              <Chip
                id={`${id}.${agent.membershipId}.count`}
                label={String(agent.assignedOpenTickets)}
                size="small"
              />
            </Stack>
          ))
        )}
      </Stack>
    </Card>
  );
}
