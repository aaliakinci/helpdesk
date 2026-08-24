import { createLilyFormController } from "@lily_platform/lily_ui/ui/forms";
import { useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import { createQueueFormDefinition, type CreateQueueFormValues } from "../model/queueForms";

export function useQueueCreateForm({
  onCreate,
}: {
  readonly onCreate: (values: CreateQueueFormValues) => Promise<boolean>;
}) {
  const { t } = useAppTranslation();
  const controller = useMemo(() => createLilyFormController<CreateQueueFormValues>(), []);
  const definition = useMemo(() => createQueueFormDefinition(t), [t]);
  const [revision, setRevision] = useState(0);

  return {
    controller,
    definition,
    revision,
    submit: async (values: CreateQueueFormValues) => {
      if (await onCreate(values)) setRevision((value) => value + 1);
    },
  };
}

export type QueueCreateFormController = ReturnType<typeof useQueueCreateForm>;
