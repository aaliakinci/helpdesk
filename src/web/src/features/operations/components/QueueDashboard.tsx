import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import type { OperationsDashboard } from "../api/operationsContract";

export function QueueDashboard({
  dashboard,
  id,
}: {
  readonly dashboard: OperationsDashboard;
  readonly id: string;
}) {
  const { t } = useAppTranslation();
  return (
    <Box
      id={id}
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
      }}
    >
      <MetricCard
        id={`${id}.open`}
        label={t("app:queues.dashboard.open")}
        value={dashboard.openTickets}
      />
      <MetricCard
        id={`${id}.unassigned`}
        label={t("app:queues.dashboard.unassigned")}
        value={dashboard.unassignedTickets}
      />
      <MetricCard
        id={`${id}.mine`}
        label={t("app:queues.dashboard.mine")}
        value={dashboard.myOpenTickets}
      />
      <MetricCard
        id={`${id}.sla`}
        label={t("app:queues.dashboard.sla")}
        value={t("app:queues.dashboard.notConfigured")}
      />
    </Box>
  );
}

function MetricCard({
  id,
  label,
  value,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Card id={id} cardTitle={label}>
      <Typography id={`${id}.value`} component="p" variant="h4">
        {value}
      </Typography>
    </Card>
  );
}
