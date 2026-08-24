import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useAccountSession } from "../hooks/useAccountSession";

export function AccountFeature({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const account = useAccountSession();
  const session = account.session;
  if (!session) return null;

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
      {account.error && (
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
            <Typography id={`${id}.identity.time-zone`} component="p">
              {t("app:shell.timeZone")}: {session.activeTenant.timeZone}
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
                  disabled={account.busy || tenant.id === session.activeTenant.id}
                  variant={tenant.id === session.activeTenant.id ? "contained" : "outlined"}
                  onClick={() => void account.switchTenant(tenant.id)}
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
                disabled={account.busy}
                variant="outlined"
                onClick={() => void account.logout()}
              >
                {t("app:session.logout")}
              </Button>
              <Button
                id={`${id}.revoke-all`}
                disabled={account.busy}
                color="error"
                variant="outlined"
                onClick={() => void account.revokeAllSessions()}
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
