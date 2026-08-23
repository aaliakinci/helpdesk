import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import {
  createLilyFormController,
  LilyForm,
  useLilyFormStatus,
  type LilyFormBindings,
} from "@lily_platform/lily_ui/ui/forms";
import { useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";
import { PublicShell } from "@/shared/components";

import type { TenantOption } from "../api/authContract";
import { useAuth } from "../model/authContext";
import {
  createLoginFormDefinition,
  emptyLoginFormValues,
  type LoginFormValues,
} from "../model/loginForm";
import { workspaceLandingPath } from "../model/workspaceLanding";

interface LoginFeatureProps {
  readonly id: string;
}

export function LoginFeature({ id }: LoginFeatureProps) {
  const navigate = useLilyNavigate();
  const auth = useAuth();
  const { changeLocale, locale, t } = useAppTranslation();
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

  return (
    <PublicShell
      id={`${id}.shell`}
      brand={t("app:brand")}
      languageLabel={t("app:shell.language")}
      locale={locale}
      onLocaleChange={(nextLocale) => void changeLocale(nextLocale)}
      skipToContentLabel={t("app:shell.skipToContent")}
    >
      <Stack id={`${id}.content`} spacing={3} sx={{ maxWidth: 560 }}>
        <Box id={`${id}.heading`}>
          <Typography
            id={`${id}.eyebrow`}
            component="p"
            variant="overline"
            sx={{ color: "primary.main" }}
          >
            {t("app:login.eyebrow")}
          </Typography>
          <Typography id={`${id}.title`} component="h1" variant="h3">
            {t("app:login.title")}
          </Typography>
          <Typography
            id={`${id}.description`}
            component="p"
            sx={{ color: "text.secondary", mt: 2 }}
          >
            {t("app:login.description")}
          </Typography>
        </Box>
        {error && (
          <Alert id={`${id}.error`} severity="error">
            {error}
          </Alert>
        )}
        <LilyForm
          bindings={bindings}
          controller={controller}
          definition={definition}
          disabled={submitting}
          initialValues={initialValues}
          initialValuesRevision={initialValuesRevision}
          instanceId={`${id}.form`}
          reinitialize="always"
          onSubmit={submit}
          onSubmitInvalid={() => setError(null)}
          onSubmitError={() => setError(t("app:login.error"))}
        />
        <Alert id={`${id}.security`} severity="info">
          {t("app:login.securityNotice")}
        </Alert>
      </Stack>
    </PublicShell>
  );
}
