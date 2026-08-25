import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Select } from "@lily_platform/lily_ui/ui/atoms/Select";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { TextField } from "@lily_platform/lily_ui/ui/atoms/TextField";

import { useAppTranslation } from "@/i18n";

import type { AuditActorType } from "../api/auditContract";
import type { AuditLogController } from "../hooks/useAuditLog";

export function AuditFilters({
  id,
  log,
}: {
  readonly id: string;
  readonly log: AuditLogController;
}) {
  const { t } = useAppTranslation();
  return (
    <Card id={`${id}.filters`} cardTitle={t("app:audit.filters.title")}>
      <Stack id={`${id}.filters.content`} spacing={2}>
        <Box
          id={`${id}.filters.grid`}
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" },
          }}
        >
          <TextField
            id={`${id}.filters.action`}
            fullWidth
            label={t("app:audit.filters.action")}
            value={log.draft.action}
            inputProps={{ maxLength: 100 }}
            onValueChange={(action) => log.setDraft({ action })}
          />
          <TextField
            id={`${id}.filters.aggregate-type`}
            fullWidth
            label={t("app:audit.filters.aggregateType")}
            value={log.draft.aggregateType}
            inputProps={{ maxLength: 80 }}
            onValueChange={(aggregateType) => log.setDraft({ aggregateType })}
          />
          <Select
            id={`${id}.filters.actor-type`}
            fullWidth
            label={t("app:audit.filters.actorType")}
            value={log.draft.actorType ?? "ALL"}
            options={[
              { id: "ALL", label: t("app:audit.filters.allActors"), value: "ALL" },
              { id: "USER", label: t("app:audit.filters.user"), value: "USER" },
              { id: "SYSTEM", label: t("app:audit.filters.system"), value: "SYSTEM" },
            ]}
            onValueChange={(value) =>
              log.setDraft({ actorType: value === "ALL" ? null : (value as AuditActorType) })
            }
          />
          <TextField
            id={`${id}.filters.actor-user-id`}
            fullWidth
            label={t("app:audit.filters.actorUserId")}
            value={log.draft.actorUserId}
            inputProps={{ maxLength: 36 }}
            onValueChange={(actorUserId) => log.setDraft({ actorUserId })}
          />
          <TextField
            id={`${id}.filters.from`}
            fullWidth
            label={t("app:audit.filters.from")}
            type="date"
            value={log.draft.from}
            InputLabelProps={{ shrink: true }}
            onValueChange={(from) => log.setDraft({ from })}
          />
          <TextField
            id={`${id}.filters.to`}
            fullWidth
            label={t("app:audit.filters.to")}
            type="date"
            value={log.draft.to}
            InputLabelProps={{ shrink: true }}
            onValueChange={(to) => log.setDraft({ to })}
          />
        </Box>
        <Stack id={`${id}.filters.actions`} direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button id={`${id}.filters.apply`} type="button" variant="contained" onClick={log.apply}>
            {t("app:audit.filters.apply")}
          </Button>
          <Button id={`${id}.filters.reset`} type="button" variant="text" onClick={log.reset}>
            {t("app:audit.filters.reset")}
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
