import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useEffect, useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import { listReadOnlyMemberships } from "../api/auditApi";
import type { TenantMembershipView } from "../api/auditContract";

interface MembershipRow extends TableRowData {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
}

export function AuditWorkspaceFeature({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  const [memberships, setMemberships] = useState<readonly TenantMembershipView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const columns = useMemo<readonly TableColumn<MembershipRow>[]>(
    () => [
      {
        id: "name",
        label: t("app:audit.columns.name"),
        priority: "primary",
        format: (value, row) => <a href={`mailto:${row.email}`}>{String(value)}</a>,
      },
      { id: "email", label: t("app:audit.columns.email"), priority: "secondary" },
      { id: "role", label: t("app:audit.columns.role"), priority: "secondary" },
      { id: "status", label: t("app:audit.columns.status"), priority: "tertiary" },
    ],
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        setMemberships(await listReadOnlyMemberships(controller.signal));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [revision]);

  const rows: MembershipRow[] = memberships.map((membership) => ({
    email: membership.user.email,
    id: membership.id,
    name: membership.user.displayName,
    role: membership.role,
    status: membership.status,
  }));

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
      {failed && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {t("app:audit.loadError")}
            </Typography>
            <Button
              id={`${id}.error.retry`}
              variant="outlined"
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("app:audit.retry")}
            </Button>
          </Stack>
        </Alert>
      )}
      <Table
        id={`${id}.memberships`}
        columns={columns as TableColumn[]}
        rows={rows}
        loading={loading}
        emptyContent={<Typography id={`${id}.empty`}>{t("app:audit.empty")}</Typography>}
      />
    </Stack>
  );
}
