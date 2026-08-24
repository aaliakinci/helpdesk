import {
  defineLilyForm,
  type LilyFormDefinition,
  type LilyValidationIssue,
} from "@lily_platform/lily_ui/ui/forms";

export interface CreateQueueFormValues {
  description: string;
  name: string;
}

export interface QueueMemberFormValues {
  membershipId: string;
}

export const emptyCreateQueueValues: CreateQueueFormValues = { description: "", name: "" };
export const emptyQueueMemberValues: QueueMemberFormValues = { membershipId: "" };

export function createQueueFormDefinition(
  t: (key: string) => string,
): LilyFormDefinition<CreateQueueFormValues> {
  return defineLilyForm<CreateQueueFormValues>({
    id: "queues.create.form",
    defaultValues: emptyCreateQueueValues,
    containerProps: { spacing: 2 },
    fields: [
      {
        kind: "text",
        name: "name",
        label: t("app:queues.form.name"),
        fullWidth: true,
        required: true,
        validators: { onSubmit: bounded(2, 120, t("app:queues.form.nameValidation")) },
      },
      {
        kind: "textarea",
        name: "description",
        label: t("app:queues.form.description"),
        fullWidth: true,
        minRows: 2,
        validators: {
          onSubmit: (value) =>
            value.trim().length === 0
              ? undefined
              : bounded(1, 500, t("app:queues.form.descriptionValidation"))(value),
        },
      },
    ],
    actions: [
      { id: "submit", kind: "submit", label: t("app:queues.form.create"), variant: "contained" },
    ],
  });
}

export function queueMemberFormDefinition(
  t: (key: string) => string,
): LilyFormDefinition<QueueMemberFormValues> {
  return defineLilyForm<QueueMemberFormValues>({
    id: "queues.member.form",
    defaultValues: emptyQueueMemberValues,
    containerProps: { spacing: 2 },
    fields: [
      {
        kind: "select",
        name: "membershipId",
        label: t("app:queues.form.member"),
        fullWidth: true,
        required: true,
        options: [],
      },
    ],
    actions: [
      { id: "submit", kind: "submit", label: t("app:queues.form.addMember"), variant: "outlined" },
    ],
  });
}

function bounded(minimum: number, maximum: number, message: string) {
  return (value: string): LilyValidationIssue | undefined => {
    const length = Array.from(value.trim()).length;
    return length >= minimum && length <= maximum
      ? undefined
      : { code: "queues.field_invalid", defaultMessage: message };
  };
}
