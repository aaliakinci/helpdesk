import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useQueueCreateForm } from "../hooks/useQueueCreateForm";
import { useQueueOperations } from "../hooks/useQueueOperations";
import { AgentWorkloadCard } from "./AgentWorkloadCard";
import { QueueCreateCard } from "./QueueCreateCard";
import { QueueDashboard } from "./QueueDashboard";
import { QueueList } from "./QueueList";

export function QueueOperationsFeature({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const operations = useQueueOperations();
  const createForm = useQueueCreateForm({ onCreate: operations.create });

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:queues.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t("app:queues.description")}
        </Typography>
      </Box>
      {operations.error && (
        <Alert id={`${id}.error`} severity="error">
          {operations.error}
        </Alert>
      )}
      {operations.dashboard && (
        <QueueDashboard id={`${id}.dashboard`} dashboard={operations.dashboard} />
      )}
      <Box
        id={`${id}.management`}
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "360px minmax(0, 1fr)" },
        }}
      >
        <Stack id={`${id}.sidebar`} spacing={3}>
          {operations.canManage && (
            <QueueCreateCard id={`${id}.create`} busy={operations.busy} form={createForm} />
          )}
          <AgentWorkloadCard id={`${id}.workload`} workload={operations.workload} />
        </Stack>
        <QueueList id={`${id}.queues`} operations={operations} />
      </Box>
    </Stack>
  );
}
