import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useState } from "react";

import { useAppTranslation } from "@/i18n";

import { useAuth } from "../model/authContext";
import { workspaceLandingPath } from "../model/workspaceLanding";

export function AccountFeature({ id }: { readonly id: string }) {
  const auth = useAuth();
  const navigate = useLilyNavigate();
  const { t } = useAppTranslation();
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
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:account.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t("app:account.description")}
        </Typography>
      </Box>
      {error && (
        <Alert id={`${id}.error`} severity="error">
          {t("app:session.actionError")}
        </Alert>
      )}
      <Box
        id={`${id}.grid`}
        sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}
      >
        <Card id={`${id}.identity`} cardTitle={t("app:account.identity")}>
          <Stack id={`${id}.identity.content`} spacing={1.5}>
            <Typography id={`${id}.identity.name`} component="p" variant="h6">
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
            <Stack
              id={`${id}.identity.permissions`}
              direction="row"
              spacing={0.75}
              sx={{ flexWrap: "wrap" }}
            >
              {session.activeTenant.permissions.map((permission) => (
                <Chip
                  key={permission}
                  id={`${id}.permission.${permission}`}
                  label={permission}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Stack>
        </Card>
        <Stack id={`${id}.actions`} spacing={3}>
          <Card id={`${id}.organizations`} cardTitle={t("app:session.switchTenant")}>
            <Stack id={`${id}.organizations.items`} spacing={1}>
              {session.tenants.map((tenant) => (
                <Button
                  id={`${id}.tenant.${tenant.slug}`}
                  key={tenant.id}
                  disabled={busy || tenant.id === session.activeTenant.id}
                  variant={tenant.id === session.activeTenant.id ? "contained" : "outlined"}
                  onClick={() =>
                    void perform(async () => {
                      const response = await auth.switchTenant(tenant.id);
                      if (response.activeTenant) {
                        await navigate(workspaceLandingPath(response.activeTenant.role));
                      }
                    })
                  }
                >
                  {tenant.name}
                </Button>
              ))}
            </Stack>
          </Card>
          <Card id={`${id}.security`} cardTitle={t("app:account.sessionActions")}>
            <Stack id={`${id}.security.actions`} spacing={1}>
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
          </Card>
        </Stack>
      </Box>
    </Stack>
  );
}
