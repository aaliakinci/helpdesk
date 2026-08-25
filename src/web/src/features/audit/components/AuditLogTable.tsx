import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useMemo } from "react";

import { useAuth } from "@/features/auth";
import { useAppTranslation } from "@/i18n";

import type { AuditLogController } from "../hooks/useAuditLog";

interface AuditRow extends TableRowData {
  readonly action: string;
  readonly actor: string;
  readonly aggregate: string;
  readonly metadata: string;
  readonly occurredAt: string;
}

export function AuditLogTable({
  id,
  log,
}: {
  readonly id: string;
  readonly log: AuditLogController;
}) {
  const auth = useAuth();
  const { locale, t } = useAppTranslation();
  const columns = useMemo<readonly TableColumn<AuditRow>[]>(
    () => [
      { id: "occurredAt", label: t("app:audit.columns.occurredAt"), priority: "primary" },
      { id: "action", label: t("app:audit.columns.action"), priority: "primary" },
      { id: "actor", label: t("app:audit.columns.actor"), priority: "secondary" },
      { id: "aggregate", label: t("app:audit.columns.aggregate"), priority: "secondary" },
      { id: "metadata", label: t("app:audit.columns.metadata"), priority: "tertiary" },
    ],
    [t],
  );
  const timeZone = auth.session?.activeTenant.timeZone ?? "UTC";
  const rows: AuditRow[] =
    log.pageData?.items.map((entry) => ({
      action: entry.action,
      actor: entry.actor.displayName ?? t("app:audit.systemActor"),
      aggregate: `${entry.aggregateType} · ${entry.aggregateId}`,
      id: entry.id,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : "—",
      occurredAt: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone,
      }).format(new Date(entry.occurredAtUtc)),
    })) ?? [];
  return (
    <Table
      id={id}
      aria-label={t("app:audit.title")}
      tabIndex={0}
      columns={columns as TableColumn[]}
      rows={rows}
      loading={log.loading}
      emptyContent={<Typography id={`${id}.empty`}>{t("app:audit.empty")}</Typography>}
      pagination
      page={(log.pageData?.page ?? 1) - 1}
      rowsPerPage={log.pageData?.pageSize ?? log.filters.pageSize}
      rowsPerPageOptions={[10, 25, 50, 100]}
      totalCount={log.pageData?.total ?? 0}
      onPageChange={(page) => log.applyPage(page + 1)}
      onRowsPerPageChange={log.applyPageSize}
    />
  );
}
