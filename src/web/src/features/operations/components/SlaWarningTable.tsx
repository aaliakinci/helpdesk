import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useMemo } from "react";

import { useAuth } from "@/features/auth";
import { formatTicketDate } from "@/features/tickets";
import { useAppTranslation } from "@/i18n";

import type { OperationsDashboardController } from "../hooks/useOperationsDashboard";

interface WarningRow extends TableRowData {
  readonly assignee: string;
  readonly due: string;
  readonly firstResponse: string;
  readonly number: string;
  readonly resolution: string;
  readonly subject: string;
}

export function SlaWarningTable({
  controller,
  id,
}: {
  readonly controller: OperationsDashboardController;
  readonly id: string;
}) {
  const auth = useAuth();
  const { locale, t } = useAppTranslation();
  const timeZone = auth.session?.activeTenant.timeZone ?? "UTC";
  const columns = useMemo<readonly TableColumn<WarningRow>[]>(
    () => [
      { id: "number", label: t("app:tickets.columns.number"), priority: "primary" },
      { id: "subject", label: t("app:tickets.columns.subject"), priority: "primary" },
      {
        id: "firstResponse",
        label: t("app:operations.warnings.firstResponse"),
        priority: "secondary",
      },
      {
        id: "resolution",
        label: t("app:operations.warnings.resolution"),
        priority: "secondary",
      },
      { id: "due", label: t("app:operations.warnings.nextDue"), priority: "secondary" },
      { id: "assignee", label: t("app:tickets.columns.assignee"), priority: "tertiary" },
    ],
    [t],
  );
  const rows: WarningRow[] =
    controller.dashboard?.sla.warnings.map((warning) => ({
      assignee: warning.assignee?.displayName ?? t("app:tickets.assignment.unassigned"),
      due: formatTicketDate(warning.nextDueAtUtc, locale, timeZone),
      firstResponse: t(`app:sla.status.${warning.firstResponseStatus}`),
      id: warning.id,
      number: `#${warning.number}`,
      resolution: t(`app:sla.status.${warning.resolutionStatus}`),
      subject: warning.subject,
    })) ?? [];
  return (
    <Table
      id={id}
      columns={columns as TableColumn[]}
      rows={rows}
      loading={controller.loading}
      emptyContent={
        <Typography id={`${id}.empty`}>{t("app:operations.warnings.empty")}</Typography>
      }
      getRowAriaLabel={(row) => `${t("app:tickets.open")} ${String(row.number)}`}
      onRowActivate={(row) => void controller.openTicket(row.id)}
    />
  );
}
