import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Select } from "@lily_platform/lily_ui/ui/atoms/Select";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { TextField } from "@lily_platform/lily_ui/ui/atoms/TextField";

import { useAppTranslation } from "@/i18n";

import type { TicketPriority, TicketStatus } from "../api/ticketContract";
import type { TicketListController } from "../hooks/useTicketList";
import type { TicketSortDirection, TicketSortField } from "../model/ticketListQuery";
import type { TicketMode } from "../model/ticketPresentation";

export function TicketFilters({
  id,
  list,
  mode,
}: {
  readonly id: string;
  readonly list: TicketListController;
  readonly mode: TicketMode;
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={`${id}.filters`} cardTitle={t("app:tickets.filters.title")}>
      <Stack id={`${id}.filters.content`} spacing={2}>
        <Box
          id={`${id}.filters.search-form`}
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            list.applySearch();
          }}
        >
          <Stack
            id={`${id}.filters.search-row`}
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
          >
            <TextField
              id={`${id}.filters.search`}
              fullWidth
              label={t("app:tickets.filters.search")}
              value={list.searchDraft}
              inputProps={{ maxLength: 120 }}
              onValueChange={list.setSearchDraft}
            />
            <Button id={`${id}.filters.search-submit`} type="submit" variant="contained">
              {t("app:tickets.filters.apply")}
            </Button>
            <Button id={`${id}.filters.reset`} type="button" variant="text" onClick={list.reset}>
              {t("app:tickets.filters.reset")}
            </Button>
          </Stack>
        </Box>
        {mode === "staff" && (
          <Stack
            id={`${id}.filters.assignment`}
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
          >
            {(["ALL", "MINE", "UNASSIGNED"] as const).map((value) => (
              <Button
                key={value}
                id={`${id}.filters.assignment.${value}`}
                variant={list.query.assignment === value ? "contained" : "outlined"}
                aria-pressed={list.query.assignment === value}
                onClick={() => list.applyQuery({ assignment: value, page: 1 })}
              >
                {t(`app:tickets.filters.${value}`)}
              </Button>
            ))}
          </Stack>
        )}
        <Box
          id={`${id}.filters.selects`}
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          <Select
            id={`${id}.filters.status`}
            fullWidth
            label={t("app:tickets.filters.status")}
            value={list.query.status ?? "ALL"}
            options={[
              { id: "ALL", label: t("app:tickets.filters.allStatuses"), value: "ALL" },
              ...(["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"] as const).map((value) => ({
                id: value,
                label: t(`app:tickets.status.${value}`),
                value,
              })),
            ]}
            onValueChange={(value) =>
              list.applyQuery({
                page: 1,
                status: value === "ALL" ? null : (value as TicketStatus),
              })
            }
          />
          <Select
            id={`${id}.filters.priority`}
            fullWidth
            label={t("app:tickets.filters.priority")}
            value={list.query.priority ?? "ALL"}
            options={[
              { id: "ALL", label: t("app:tickets.filters.allPriorities"), value: "ALL" },
              ...(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((value) => ({
                id: value,
                label: t(`app:tickets.priority.${value}`),
                value,
              })),
            ]}
            onValueChange={(value) =>
              list.applyQuery({
                page: 1,
                priority: value === "ALL" ? null : (value as TicketPriority),
              })
            }
          />
          {mode === "staff" && (
            <Select
              id={`${id}.filters.queue`}
              fullWidth
              label={t("app:tickets.filters.queue")}
              value={list.query.queueId ?? "ALL"}
              options={[
                { id: "ALL", label: t("app:tickets.filters.allQueues"), value: "ALL" },
                ...list.queues.map((queue) => ({
                  id: queue.id,
                  label: queue.name,
                  value: queue.id,
                })),
              ]}
              onValueChange={(value) =>
                list.applyQuery({ page: 1, queueId: value === "ALL" ? null : String(value) })
              }
            />
          )}
          <Select
            id={`${id}.filters.sort`}
            fullWidth
            label={t("app:tickets.filters.sort")}
            value={list.query.sortBy}
            options={(["updatedAt", "createdAt", "number", "priority"] as const).map((value) => ({
              id: value,
              label: t(`app:tickets.filters.sortBy.${value}`),
              value,
            }))}
            onValueChange={(value) =>
              list.applyQuery({ page: 1, sortBy: value as TicketSortField })
            }
          />
          <Select
            id={`${id}.filters.direction`}
            fullWidth
            label={t("app:tickets.filters.direction")}
            value={list.query.sortDirection}
            options={(["desc", "asc"] as const).map((value) => ({
              id: value,
              label: t(`app:tickets.filters.${value}`),
              value,
            }))}
            onValueChange={(value) =>
              list.applyQuery({ page: 1, sortDirection: value as TicketSortDirection })
            }
          />
          <Select
            id={`${id}.filters.page-size`}
            fullWidth
            label={t("app:tickets.filters.pageSize")}
            value={list.query.pageSize}
            options={[10, 25, 50].map((value) => ({
              id: String(value),
              label: String(value),
              value,
            }))}
            onValueChange={(value) =>
              list.applyQuery({ page: 1, pageSize: Number(value) as 10 | 25 | 50 })
            }
          />
        </Box>
      </Stack>
    </Card>
  );
}
