import {
  defineLilyForm,
  type LilyFormDefinition,
  type LilyValidationIssue,
} from "@lily_platform/lily_ui/ui/forms";

export interface LoginFormValues {
  email: string;
  password: string;
  tenantId: string;
}

export const emptyLoginFormValues: LoginFormValues = { email: "", password: "", tenantId: "" };

export function createLoginFormDefinition(
  t: (key: string) => string,
): LilyFormDefinition<LoginFormValues> {
  const issue = (code: string, defaultMessage: string): LilyValidationIssue => ({
    code,
    defaultMessage,
  });
  return defineLilyForm<LoginFormValues>({
    id: "login.form",
    defaultValues: emptyLoginFormValues,
    containerProps: { spacing: 2.5 },
    fields: [
      {
        kind: "email",
        name: "email",
        label: t("app:login.email"),
        autoComplete: "username",
        fullWidth: true,
        required: true,
        validators: {
          onSubmit: (value) =>
            /^\S+@\S+\.\S+$/.test(value.trim())
              ? undefined
              : issue("login.email_invalid", t("app:login.emailValidation")),
        },
      },
      {
        kind: "password",
        name: "password",
        label: t("app:login.password"),
        autoComplete: "current-password",
        fullWidth: true,
        required: true,
        validators: {
          onSubmit: (value) =>
            value.length > 0
              ? undefined
              : issue("login.password_required", t("app:login.passwordValidation")),
        },
      },
      {
        kind: "select",
        name: "tenantId",
        label: t("app:login.tenant"),
        options: [],
        fullWidth: true,
        required: true,
      },
    ],
    actions: [{ id: "submit", kind: "submit", label: t("app:login.submit"), variant: "contained" }],
  });
}
