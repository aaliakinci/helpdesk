import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import {
  createLilyFormController,
  useLilyFormStatus,
  type LilyFormBindings,
} from "@lily_platform/lily_ui/ui/forms";
import { useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import type { TenantOption } from "../api/authContract";
import { useAuth } from "../model/authContext";
import {
  createLoginFormDefinition,
  emptyLoginFormValues,
  type LoginFormValues,
} from "../model/loginForm";
import { workspaceLandingPath } from "../model/workspaceLanding";

export function useLogin() {
  const navigate = useLilyNavigate();
  const auth = useAuth();
  const { t } = useAppTranslation();
  const [tenantOptions, setTenantOptions] = useState<readonly TenantOption[]>([]);
  const [initialValues, setInitialValues] = useState<LoginFormValues>(emptyLoginFormValues);
  const [initialValuesRevision, setInitialValuesRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const definition = useMemo(() => createLoginFormDefinition(t), [t]);
  const controller = useMemo(() => createLilyFormController<LoginFormValues>(), []);
  const submitting = useLilyFormStatus(controller, (status) => status.isSubmitting);
  const bindings = useMemo<LilyFormBindings<LoginFormValues>>(
    () => ({
      tenantId: {
        visible: tenantOptions.length > 0,
        options: tenantOptions.map((tenant) => ({
          id: tenant.id,
          label: `${tenant.name} — ${tenant.role}`,
          value: tenant.id,
        })),
      },
    }),
    [tenantOptions],
  );

  async function submit(values: LoginFormValues): Promise<void> {
    setError(null);
    if (tenantOptions.length > 0 && values.tenantId.length === 0) {
      setError(t("app:login.tenantRequired"));
      return;
    }
    try {
      const response = await auth.login({
        email: values.email.trim(),
        password: values.password,
        tenantId: values.tenantId || null,
      });
      if (response.requiresTenantSelection) {
        setTenantOptions(response.tenants);
        setInitialValues({ ...values, tenantId: response.tenants[0]?.id ?? "" });
        setInitialValuesRevision((revision) => revision + 1);
        return;
      }
      if (response.activeTenant) await navigate(workspaceLandingPath(response.activeTenant.role));
    } catch {
      setError(t("app:login.error"));
    }
  }

  return {
    bindings,
    controller,
    definition,
    error,
    initialValues,
    initialValuesRevision,
    submitting,
    submit,
    clearError: () => setError(null),
    handleSubmitError: () => setError(t("app:login.error")),
  };
}
