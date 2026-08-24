import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

import { useReadOnlyMemberships } from "../hooks/useReadOnlyMemberships";
import { AuditMembershipTable } from "./AuditMembershipTable";

export function AuditWorkspaceFeature({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const memberships = useReadOnlyMemberships();

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Stack
          id={`${id}.heading.row`}
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box id={`${id}.heading.copy`}>
            <Typography id={`${id}.title`} component="h1" variant="h3">
              {t("app:audit.title")}
            </Typography>
            <Typography
              id={`${id}.description`}
              component="p"
              sx={{ color: "text.secondary", mt: 1 }}
            >
              {t("app:audit.description")}
            </Typography>
          </Box>
          <Chip id={`${id}.read-only`} variant="outlined" label={t("app:audit.readOnly")} />
        </Stack>
      </Box>
      {memberships.failed && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {t("app:audit.loadError")}
            </Typography>
            <Button id={`${id}.error.retry`} variant="outlined" onClick={memberships.reload}>
              {t("app:audit.retry")}
            </Button>
          </Stack>
        </Alert>
      )}
      <AuditMembershipTable
        id={`${id}.memberships`}
        loading={memberships.loading}
        memberships={memberships.memberships}
      />
    </Stack>
  );
}
