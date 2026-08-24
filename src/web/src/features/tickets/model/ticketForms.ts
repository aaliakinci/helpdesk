import {
  defineLilyForm,
  type LilyFormDefinition,
  type LilyValidationIssue,
} from "@lily_platform/lily_ui/ui/forms";

import type { TicketCommentVisibility, TicketPriority } from "../api/ticketContract";

export interface CreateTicketFormValues {
  description: string;
  priority: TicketPriority;
  requesterContactId: string;
  subject: string;
}

export interface ReplyFormValues {
  body: string;
  visibility: TicketCommentVisibility;
}

export const emptyCreateTicketValues: CreateTicketFormValues = {
  description: "",
  priority: "NORMAL",
  requesterContactId: "",
  subject: "",
};

export const emptyReplyValues: ReplyFormValues = { body: "", visibility: "PUBLIC" };

export function createTicketFormDefinition(
  t: (key: string) => string,
): LilyFormDefinition<CreateTicketFormValues> {
  return defineLilyForm<CreateTicketFormValues>({
    id: "tickets.create.form",
    defaultValues: emptyCreateTicketValues,
    containerProps: { spacing: 2 },
    fields: [
      {
        kind: "text",
        name: "subject",
        label: t("app:tickets.form.subject"),
        fullWidth: true,
        required: true,
        validators: { onSubmit: bounded(3, 200, t("app:tickets.form.subjectValidation")) },
      },
      {
        kind: "textarea",
        name: "description",
        label: t("app:tickets.form.description"),
        fullWidth: true,
        required: true,
        minRows: 4,
        validators: { onSubmit: bounded(1, 10_000, t("app:tickets.form.descriptionValidation")) },
      },
      {
        kind: "select",
        name: "priority",
        label: t("app:tickets.form.priority"),
        fullWidth: true,
        required: true,
        options: ["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => ({
          id: value,
          label: t(`app:tickets.priority.${value}`),
          value: value as TicketPriority,
        })),
      },
      {
        kind: "select",
        name: "requesterContactId",
        label: t("app:tickets.form.requester"),
        fullWidth: true,
        required: true,
        options: [],
      },
    ],
    actions: [
      { id: "submit", kind: "submit", label: t("app:tickets.form.create"), variant: "contained" },
    ],
  });
}

export function replyFormDefinition(
  t: (key: string) => string,
  visibility: TicketCommentVisibility = "PUBLIC",
): LilyFormDefinition<ReplyFormValues> {
  return defineLilyForm<ReplyFormValues>({
    id: "tickets.reply.form",
    defaultValues: { body: "", visibility },
    containerProps: { spacing: 2 },
    fields: [
      {
        kind: "textarea",
        name: "body",
        label: t("app:tickets.reply.body"),
        fullWidth: true,
        minRows: 3,
        required: true,
        validators: { onSubmit: bounded(1, 10_000, t("app:tickets.reply.validation")) },
      },
    ],
    actions: [
      { id: "submit", kind: "submit", label: t("app:tickets.reply.send"), variant: "contained" },
    ],
  });
}

function bounded(minimum: number, maximum: number, message: string) {
  return (value: string): LilyValidationIssue | undefined => {
    const length = Array.from(value.trim()).length;
    return length >= minimum && length <= maximum
      ? undefined
      : { code: "tickets.field_invalid", defaultMessage: message };
  };
}
