import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useMemo } from "react";

import { useAppTranslation } from "@/i18n";

import type { TicketListController } from "../hooks/useTicketList";
import { formatTicketDate } from "../model/ticketPresentation";

interface TicketRow extends TableRowData {
  readonly number: string;
  readonly assignee: string;
  readonly priority: string;
  readonly requester: string;
  readonly queue: string;
  readonly status: string;
  readonly subject: string;
  readonly updatedAt: string;
}

export function TicketTable({
  id,
  list,
}: {
  readonly id: string;
  readonly list: TicketListController;
}) {
  const { t } = useAppTranslation();
  const columns = useMemo<readonly TableColumn<TicketRow>[]>(
    () => [
      { id: "number", label: t("app:tickets.columns.number"), priority: "primary" },
      { id: "subject", label: t("app:tickets.columns.subject"), priority: "primary" },
      { id: "status", label: t("app:tickets.columns.status"), priority: "secondary" },
      { id: "priority", label: t("app:tickets.columns.priority"), priority: "secondary" },
      { id: "queue", label: t("app:tickets.columns.queue"), priority: "secondary" },
      { id: "assignee", label: t("app:tickets.columns.assignee"), priority: "secondary" },
      { id: "requester", label: t("app:tickets.columns.requester"), priority: "tertiary" },
      { id: "updatedAt", label: t("app:tickets.columns.updated"), priority: "tertiary" },
    ],
    [t],
  );
  const rows: TicketRow[] =
    list.pageData?.items.map((ticket) => ({
      id: ticket.id,
      assignee: ticket.assignee?.displayName ?? t("app:tickets.assignment.unassigned"),
      number: `#${ticket.number}`,
      priority: t(`app:tickets.priority.${ticket.priority}`),
      queue: ticket.queue?.name ?? t("app:tickets.assignment.noQueue"),
      requester: ticket.requester.displayName,
      status: t(`app:tickets.status.${ticket.status}`),
      subject: ticket.subject,
      updatedAt: formatTicketDate(ticket.updatedAtUtc, list.locale, list.timeZone),
    })) ?? [];
  return (
    <Table
      id={`${id}.table`}
      columns={columns as TableColumn[]}
      rows={rows}
      loading={list.loading}
      emptyContent={<Typography id={`${id}.empty`}>{t("app:tickets.empty")}</Typography>}
      getRowAriaLabel={(row) => `${t("app:tickets.open")} ${String(row.number)}`}
      pagination
      page={(list.pageData?.page ?? 1) - 1}
      rowsPerPage={list.pageData?.pageSize ?? 10}
      totalCount={list.pageData?.total ?? 0}
      onPageChange={(nextPage) => list.applyQuery({ page: nextPage + 1 })}
      onRowActivate={(row) => list.open(row.id)}
    />
  );
}
