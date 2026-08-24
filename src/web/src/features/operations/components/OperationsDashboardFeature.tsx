import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";
import { SlaPolicyPanel } from "@/features/sla";

import { useOperationsDashboard } from "../hooks/useOperationsDashboard";
import { AgentWorkloadCard } from "./AgentWorkloadCard";
import { QueueDashboard } from "./QueueDashboard";
import { SlaWarningTable } from "./SlaWarningTable";

export function OperationsDashboardFeature({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const operations = useOperationsDashboard();
  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:operations.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t("app:operations.description")}
        </Typography>
      </Box>
      {operations.error && (
        <Alert
          id={`${id}.error`}
          severity="error"
          action={
            <Button id={`${id}.error.retry`} onClick={operations.reload}>
              {t("app:shell.retry")}
            </Button>
          }
        >
          {operations.error}
        </Alert>
      )}
      {operations.dashboard && (
        <QueueDashboard id={`${id}.metrics`} dashboard={operations.dashboard} />
      )}
      <Card id={`${id}.warnings`} cardTitle={t("app:operations.warnings.title")}>
        <SlaWarningTable id={`${id}.warnings.table`} controller={operations} />
      </Card>
      <Box
        id={`${id}.detail-grid`}
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.4fr)" },
        }}
      >
        <AgentWorkloadCard id={`${id}.workload`} workload={operations.workload} />
        <SlaPolicyPanel id={`${id}.policy`} />
      </Box>
    </Stack>
  );
}
