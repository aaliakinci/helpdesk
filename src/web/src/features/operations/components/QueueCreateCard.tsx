import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { LilyForm } from "@lily_platform/lily_ui/ui/forms";

import { useAppTranslation } from "@/i18n";

import type { QueueCreateFormController } from "../hooks/useQueueCreateForm";
import { emptyCreateQueueValues } from "../model/queueForms";

export function QueueCreateCard({
  busy,
  form,
  id,
}: {
  readonly busy: boolean;
  readonly form: QueueCreateFormController;
  readonly id: string;
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={id} cardTitle={t("app:queues.form.title")}>
      <LilyForm
        controller={form.controller}
        definition={form.definition}
        disabled={busy}
        initialValues={emptyCreateQueueValues}
        initialValuesRevision={form.revision}
        instanceId={`${id}.form`}
        reinitialize="always"
        onSubmit={form.submit}
      />
    </Card>
  );
}
