import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useState } from "react";

import { useAppTranslation } from "@/i18n";
import { PublicShell } from "@/shared/components";

import { useAuth } from "../model/authContext";
import { workspaceLandingPath } from "../model/workspaceLanding";

interface SessionFeatureProps {
  readonly id: string;
  readonly mode: "staff" | "requester" | "auditor";
}

export function SessionFeature({ id, mode }: SessionFeatureProps) {
  const auth = useAuth();
  const navigate = useLilyNavigate();
  const { changeLocale, locale, t } = useAppTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const session = auth.session;
  if (!session) return null;

  async function perform(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
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
      <Stack id={`${id}.content`} spacing={3}>
        <Box id={`${id}.heading`}>
          <Typography
            id={`${id}.eyebrow`}
            component="p"
            variant="overline"
            sx={{ color: "primary.main" }}
          >
            {t(`app:session.${mode}.eyebrow`)}
          </Typography>
          <Typography id={`${id}.title`} component="h1" variant="h3">
            {t(`app:session.${mode}.title`)}
          </Typography>
          <Typography
            id={`${id}.description`}
            component="p"
            sx={{ color: "text.secondary", mt: 2 }}
          >
            {t(`app:session.${mode}.description`)}
          </Typography>
        </Box>
        {error && (
          <Alert id={`${id}.error`} severity="error">
            {t("app:session.actionError")}
          </Alert>
        )}
        <Box
          id={`${id}.identity`}
          sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 3 }}
        >
          <Stack id={`${id}.identity.content`} spacing={1}>
            <Typography id={`${id}.identity.name`} component="h2" variant="h6">
              {session.user.displayName}
            </Typography>
            <Typography id={`${id}.identity.email`} component="p">
              {session.user.email}
            </Typography>
            <Typography id={`${id}.identity.tenant`} component="p">
              {t("app:session.tenant")}: {session.activeTenant.name}
            </Typography>
            <Typography id={`${id}.identity.role`} component="p">
              {t("app:session.role")}: {session.activeTenant.role}
            </Typography>
            <Typography
              id={`${id}.identity.permissions`}
              component="p"
              sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
            >
              {t("app:session.permissions")}: {session.activeTenant.permissions.join(", ")}
            </Typography>
          </Stack>
        </Box>
        {session.tenants.length > 1 && (
          <Stack id={`${id}.tenants`} spacing={1}>
            <Typography id={`${id}.tenants.title`} component="h2" variant="h6">
              {t("app:session.switchTenant")}
            </Typography>
            <Stack
              id={`${id}.tenants.actions`}
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap" }}
            >
              {session.tenants.map((tenant) => (
                <Button
                  id={`${id}.tenant.${tenant.slug}`}
                  key={tenant.id}
                  disabled={busy || tenant.id === session.activeTenant.id}
                  variant={tenant.id === session.activeTenant.id ? "contained" : "outlined"}
                  onClick={() =>
                    void perform(async () => {
                      const response = await auth.switchTenant(tenant.id);
                      if (response.activeTenant)
                        await navigate(workspaceLandingPath(response.activeTenant.role));
                    })
                  }
                >
                  {tenant.name}
                </Button>
              ))}
            </Stack>
          </Stack>
        )}
        <Stack id={`${id}.actions`} direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            id={`${id}.logout`}
            disabled={busy}
            variant="outlined"
            onClick={() =>
              void perform(async () => {
                await auth.logout();
                await navigate("/login");
              })
            }
          >
            {t("app:session.logout")}
          </Button>
          <Button
            id={`${id}.revoke-all`}
            disabled={busy}
            color="error"
            variant="outlined"
            onClick={() =>
              void perform(async () => {
                await auth.revokeAllSessions();
                await navigate("/login");
              })
            }
          >
            {t("app:session.revokeAll")}
          </Button>
        </Stack>
      </Stack>
    </PublicShell>
  );
}
