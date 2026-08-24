import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { LilyForm } from "@lily_platform/lily_ui/ui/forms";

import { useAppTranslation } from "@/i18n";
import { PublicShell } from "@/shared/components";

import { useLogin } from "../hooks/useLogin";

interface LoginFeatureProps {
  readonly id: string;
}

export function LoginFeature({ id }: LoginFeatureProps) {
  const { changeLocale, locale, t } = useAppTranslation();
  const login = useLogin();

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
        {login.error && (
          <Alert id={`${id}.error`} severity="error">
            {login.error}
          </Alert>
        )}
        <LilyForm
          bindings={login.bindings}
          controller={login.controller}
          definition={login.definition}
          disabled={login.submitting}
          initialValues={login.initialValues}
          initialValuesRevision={login.initialValuesRevision}
          instanceId={`${id}.form`}
          reinitialize="always"
          onSubmit={login.submit}
          onSubmitInvalid={login.clearError}
          onSubmitError={login.handleSubmitError}
        />
        <Alert id={`${id}.security`} severity="info">
          {t("app:login.securityNotice")}
        </Alert>
      </Stack>
    </PublicShell>
  );
}
