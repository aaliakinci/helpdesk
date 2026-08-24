import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useMemo } from "react";

import { useAppTranslation } from "@/i18n";

import type { TenantMembershipView } from "../api/auditContract";

interface MembershipRow extends TableRowData {
  readonly email: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
}

interface AuditMembershipTableProps {
  readonly id: string;
  readonly loading: boolean;
  readonly memberships: readonly TenantMembershipView[];
}

export function AuditMembershipTable({ id, loading, memberships }: AuditMembershipTableProps) {
  const { t } = useAppTranslation();
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
  const rows: MembershipRow[] = memberships.map((membership) => ({
    email: membership.user.email,
    id: membership.id,
    name: membership.user.displayName,
    role: membership.role,
    status: membership.status,
  }));

  return (
    <Table
      id={id}
      columns={columns as TableColumn[]}
      rows={rows}
      loading={loading}
      emptyContent={<Typography id={`${id}.empty`}>{t("app:audit.empty")}</Typography>}
    />
  );
}
