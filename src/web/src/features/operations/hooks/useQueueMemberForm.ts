import { createLilyFormController, type LilyFormBindings } from "@lily_platform/lily_ui/ui/forms";
import { useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import type { EligibleQueueMember, QueueMemberStatus } from "../api/operationsContract";
import { queueMemberFormDefinition, type QueueMemberFormValues } from "../model/queueForms";

export function useQueueMemberForm({
  eligible,
  onSetMember,
}: {
  readonly eligible: readonly EligibleQueueMember[];
  readonly onSetMember: (membershipId: string, status: QueueMemberStatus) => Promise<boolean>;
}) {
  const { t } = useAppTranslation();
  const controller = useMemo(() => createLilyFormController<QueueMemberFormValues>(), []);
  const definition = useMemo(() => queueMemberFormDefinition(t), [t]);
  const [revision, setRevision] = useState(0);
  const bindings = useMemo<LilyFormBindings<QueueMemberFormValues>>(
    () => ({
      membershipId: {
        options: eligible.map((member) => ({
          id: member.membershipId,
          label: `${member.displayName} (${member.email})`,
          value: member.membershipId,
        })),
      },
    }),
    [eligible],
  );

  return {
    bindings,
    controller,
    definition,
    revision,
    submit: async (values: QueueMemberFormValues) => {
      if (await onSetMember(values.membershipId, "ACTIVE")) {
        setRevision((value) => value + 1);
      }
    },
  };
}
