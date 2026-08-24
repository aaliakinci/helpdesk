import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import {
  createLilyFormController,
  LilyForm,
  type LilyFormBindings,
} from "@lily_platform/lily_ui/ui/forms";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth";
import { useAppTranslation } from "@/i18n";

import {
  createQueue,
  getDashboard,
  listAgentWorkload,
  listEligibleMembers,
  listQueues,
  setQueueMember,
  updateQueue,
} from "../api/operationsApi";
import type {
  AgentWorkload,
  EligibleQueueMember,
  OperationsDashboard,
  QueueView,
} from "../api/operationsContract";
import {
  createQueueFormDefinition,
  emptyCreateQueueValues,
  emptyQueueMemberValues,
  queueMemberFormDefinition,
  type CreateQueueFormValues,
  type QueueMemberFormValues,
} from "../model/queueForms";

export function QueueOperationsFeature({ id }: { readonly id: string }) {
  const auth = useAuth();
  const { t } = useAppTranslation();
  const role = auth.session?.activeTenant?.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [queues, setQueues] = useState<readonly QueueView[]>([]);
  const [eligible, setEligible] = useState<readonly EligibleQueueMember[]>([]);
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [workload, setWorkload] = useState<readonly AgentWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [formRevision, setFormRevision] = useState(0);
  const controller = useMemo(() => createLilyFormController<CreateQueueFormValues>(), []);
  const definition = useMemo(() => createQueueFormDefinition(t), [t]);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const [nextQueues, nextDashboard, nextWorkload, nextEligible] = await Promise.all([
          listQueues(controller.signal),
          getDashboard(controller.signal),
          listAgentWorkload(controller.signal),
          canManage ? listEligibleMembers(controller.signal) : Promise.resolve([]),
        ]);
        setQueues(nextQueues);
        setDashboard(nextDashboard);
        setWorkload(nextWorkload);
        setEligible(nextEligible);
      } catch {
        if (!controller.signal.aborted) setError(t("app:queues.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [canManage, revision, t]);

  async function perform(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      setRevision((value) => value + 1);
      return true;
    } catch {
      setError(t("app:queues.actionError"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:queues.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t("app:queues.description")}
        </Typography>
      </Box>
      {error && (
        <Alert id={`${id}.error`} severity="error">
          {error}
        </Alert>
      )}
      {dashboard && (
        <Box
          id={`${id}.dashboard`}
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
          }}
        >
          <MetricCard
            id={`${id}.dashboard.open`}
            label={t("app:queues.dashboard.open")}
            value={dashboard.openTickets}
          />
          <MetricCard
            id={`${id}.dashboard.unassigned`}
            label={t("app:queues.dashboard.unassigned")}
            value={dashboard.unassignedTickets}
          />
          <MetricCard
            id={`${id}.dashboard.mine`}
            label={t("app:queues.dashboard.mine")}
            value={dashboard.myOpenTickets}
          />
          <MetricCard
            id={`${id}.dashboard.sla`}
            label={t("app:queues.dashboard.sla")}
            value={t("app:queues.dashboard.notConfigured")}
          />
        </Box>
      )}
      <Box
        id={`${id}.management`}
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "360px minmax(0, 1fr)" },
        }}
      >
        <Stack id={`${id}.sidebar`} spacing={3}>
          {canManage && (
            <Card id={`${id}.create`} cardTitle={t("app:queues.form.title")}>
              <LilyForm
                controller={controller}
                definition={definition}
                disabled={busy}
                initialValues={emptyCreateQueueValues}
                initialValuesRevision={formRevision}
                instanceId={`${id}.create.form`}
                reinitialize="always"
                onSubmit={async (values) => {
                  const created = await perform(() =>
                    createQueue({
                      description: values.description.trim() || null,
                      name: values.name.trim(),
                    }),
                  );
                  if (created) setFormRevision((value) => value + 1);
                }}
              />
            </Card>
          )}
          <Card id={`${id}.workload`} cardTitle={t("app:queues.workload.title")}>
            <Stack id={`${id}.workload.items`} spacing={1}>
              {workload.length === 0 ? (
                <Typography id={`${id}.workload.empty`}>
                  {t("app:queues.workload.empty")}
                </Typography>
              ) : (
                workload.map((agent) => (
                  <Stack
                    key={agent.membershipId}
                    id={`${id}.workload.${agent.membershipId}`}
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Typography id={`${id}.workload.${agent.membershipId}.name`} component="span">
                      {agent.displayName}
                    </Typography>
                    <Chip
                      id={`${id}.workload.${agent.membershipId}.count`}
                      label={String(agent.assignedOpenTickets)}
                      size="small"
                    />
                  </Stack>
                ))
              )}
            </Stack>
          </Card>
        </Stack>
        <Stack id={`${id}.queues`} spacing={2}>
          <Typography id={`${id}.queues.title`} component="h2" variant="h5">
            {t("app:queues.listTitle")}
          </Typography>
          {loading && queues.length === 0 ? (
            <Typography id={`${id}.loading`}>{t("app:queues.loading")}</Typography>
          ) : queues.length === 0 ? (
            <Alert id={`${id}.empty`} severity="info">
              {t("app:queues.empty")}
            </Alert>
          ) : (
            <Stack id={`${id}.items`} spacing={2}>
              {queues.map((queue) => (
                <QueueCard
                  key={queue.id}
                  busy={busy}
                  canManage={canManage}
                  eligible={eligible}
                  id={`${id}.queue.${queue.id}`}
                  queue={queue}
                  onSetMember={(membershipId, status) =>
                    perform(() =>
                      setQueueMember(queue.id, {
                        expectedVersion: queue.version,
                        membershipId,
                        status,
                      }),
                    )
                  }
                  onToggle={() =>
                    perform(() =>
                      updateQueue(queue.id, {
                        description: queue.description,
                        expectedVersion: queue.version,
                        name: queue.name,
                        status: queue.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      }),
                    )
                  }
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

function QueueCard({
  busy,
  canManage,
  eligible,
  id,
  onSetMember,
  onToggle,
  queue,
}: {
  readonly busy: boolean;
  readonly canManage: boolean;
  readonly eligible: readonly EligibleQueueMember[];
  readonly id: string;
  readonly onSetMember: (membershipId: string, status: "ACTIVE" | "DISABLED") => Promise<boolean>;
  readonly onToggle: () => Promise<boolean>;
  readonly queue: QueueView;
}) {
  const { t } = useAppTranslation();
  const controller = useMemo(() => createLilyFormController<QueueMemberFormValues>(), []);
  const definition = useMemo(() => queueMemberFormDefinition(t), [t]);
  const [formRevision, setFormRevision] = useState(0);
  const bindings = useMemo<LilyFormBindings<QueueMemberFormValues>>(
    () => ({
      membershipId: {
        options: eligible.map((member) => ({
          id: member.membershipId,
          label: `${member.displayName} (${member.email})`,
          value: member.membershipId,
        })),
      },
    }),
    [eligible],
  );
  return (
    <Card
      id={id}
      cardTitle={queue.name}
      subheader={queue.description ?? t("app:queues.noDescription")}
      headerAction={
        <Chip
          id={`${id}.status`}
          label={t(`app:queues.status.${queue.status}`)}
          color={queue.status === "ACTIVE" ? "success" : "default"}
        />
      }
    >
      <Stack id={`${id}.content`} spacing={2}>
        <Typography id={`${id}.counts`} component="p">
          {t("app:queues.openTickets")}: {queue.openTicketCount} ·{" "}
          {t("app:queues.unassignedTickets")}: {queue.unassignedTicketCount}
        </Typography>
        <Stack id={`${id}.members`} spacing={1}>
          {queue.members.length === 0 ? (
            <Typography id={`${id}.members.empty`}>{t("app:queues.noMembers")}</Typography>
          ) : (
            queue.members.map((member) => (
              <Stack
                key={member.membershipId}
                id={`${id}.member.${member.membershipId}`}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <Chip
                  id={`${id}.member.${member.membershipId}.label`}
                  label={`${member.displayName} — ${t(`app:queues.memberStatus.${member.status}`)}`}
                  variant="outlined"
                />
                {canManage && (
                  <Button
                    id={`${id}.member.${member.membershipId}.toggle`}
                    disabled={busy}
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      void onSetMember(
                        member.membershipId,
                        member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      )
                    }
                  >
                    {t(
                      member.status === "ACTIVE"
                        ? "app:queues.disableMember"
                        : "app:queues.enableMember",
                    )}
                  </Button>
                )}
              </Stack>
            ))
          )}
        </Stack>
        {canManage && (
          <LilyForm
            bindings={bindings}
            controller={controller}
            definition={definition}
            disabled={busy || eligible.length === 0}
            initialValues={emptyQueueMemberValues}
            initialValuesRevision={formRevision}
            instanceId={`${id}.member.form`}
            reinitialize="always"
            onSubmit={async (values) => {
              const changed = await onSetMember(values.membershipId, "ACTIVE");
              if (changed) setFormRevision((value) => value + 1);
            }}
          />
        )}
        {canManage && (
          <Button
            id={`${id}.toggle`}
            disabled={busy}
            color={queue.status === "ACTIVE" ? "error" : "primary"}
            variant="outlined"
            onClick={() => void onToggle()}
          >
            {t(queue.status === "ACTIVE" ? "app:queues.disable" : "app:queues.enable")}
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function MetricCard({
  id,
  label,
  value,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <Card id={id} cardTitle={label}>
      <Typography id={`${id}.value`} component="p" variant="h4">
        {value}
      </Typography>
    </Card>
  );
}
