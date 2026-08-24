import { LilyApiError, LilyNetworkError, normalizeError } from "@lily_platform/lily_ui/errors";
import { useLilyLocation, useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Divider } from "@lily_platform/lily_ui/ui/atoms/Divider";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Select } from "@lily_platform/lily_ui/ui/atoms/Select";
import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { TextField } from "@lily_platform/lily_ui/ui/atoms/TextField";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import {
  createLilyFormController,
  LilyForm,
  type LilyFormBindings,
} from "@lily_platform/lily_ui/ui/forms";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth";
import { listQueues, type QueueView } from "@/features/operations";
import { useAppTranslation } from "@/i18n";

import {
  addTicketComment,
  assignTicket,
  changeTicketStatus,
  createTicket,
  getTicket,
  listCustomers,
  listTickets,
  reopenTicket,
  roundRobinTicket,
  setTicketQueue,
  takeOverTicket,
  unassignTicket,
} from "../api/ticketApi";
import type {
  CustomerOption,
  TicketDetail,
  TicketPage,
  TicketPriority,
  TicketStatus,
} from "../api/ticketContract";
import {
  createTicketFormDefinition,
  emptyCreateTicketValues,
  emptyReplyValues,
  replyFormDefinition,
  type CreateTicketFormValues,
  type ReplyFormValues,
} from "../model/ticketForms";
import {
  defaultTicketListQuery,
  parseTicketListQuery,
  serializeTicketListQuery,
  type TicketListQuery,
  type TicketSortDirection,
  type TicketSortField,
} from "../model/ticketListQuery";

interface TicketWorkspaceFeatureProps {
  readonly id: string;
  readonly mode: "requester" | "staff";
  readonly ticketId?: string | undefined;
  readonly view?: "create" | "list";
}

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

interface TicketUiError {
  readonly kind: "conflict" | "forbidden" | "network" | "validation" | "unknown";
  readonly message: string;
  readonly traceId: string | null;
}

const STATUS_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "PENDING", "RESOLVED"],
  OPEN: ["PENDING", "RESOLVED"],
  PENDING: ["OPEN", "RESOLVED"],
  RESOLVED: [],
  CLOSED: [],
};

export function TicketWorkspaceFeature({
  id,
  mode,
  ticketId,
  view = "list",
}: TicketWorkspaceFeatureProps) {
  const auth = useAuth();
  const location = useLilyLocation();
  const navigate = useLilyNavigate();
  const { locale, t } = useAppTranslation();
  const listQuery = useMemo(() => parseTicketListQuery(location.search), [location.search]);
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    source: listQuery.search,
    value: listQuery.search,
  }));
  const searchDraft =
    searchDraftState.source === listQuery.search ? searchDraftState.value : listQuery.search;
  const [pageData, setPageData] = useState<TicketPage | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [customers, setCustomers] = useState<readonly CustomerOption[]>([]);
  const [queues, setQueues] = useState<readonly QueueView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TicketUiError | null>(null);
  const [revision, setRevision] = useState(0);
  const [createRevision, setCreateRevision] = useState(0);
  const [replyRevision, setReplyRevision] = useState(0);
  const basePath = mode === "requester" ? "/portal" : "/workspace";
  const role = auth.session?.activeTenant?.role;
  const canManageAssignments = role === "OWNER" || role === "MANAGER";
  const canTakeOver = role === "AGENT";
  const timeZone = auth.session?.activeTenant.timeZone ?? "UTC";

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
        if (ticketId) {
          const [nextDetail, nextQueues] = await Promise.all([
            getTicket(ticketId, controller.signal),
            mode === "staff" ? listQueues(controller.signal) : Promise.resolve([]),
          ]);
          setDetail(nextDetail);
          setQueues(nextQueues);
        } else if (view === "create") {
          const customerOptions = mode === "staff" ? await listCustomers(controller.signal) : [];
          setCustomers(customerOptions);
        } else {
          const [tickets, nextQueues] = await Promise.all([
            listTickets(
              {
                ...listQuery,
                assignment: mode === "requester" ? "ALL" : listQuery.assignment,
                queueId: mode === "requester" ? null : listQuery.queueId,
              },
              controller.signal,
            ),
            mode === "staff" ? listQueues(controller.signal) : Promise.resolve([]),
          ]);
          setPageData(tickets);
          setQueues(nextQueues);
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(toTicketUiError(cause, t, "load"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [listQuery, mode, revision, t, ticketId, view]);

  async function perform(action: () => Promise<TicketDetail>): Promise<TicketDetail | null> {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setDetail(next);
      setRevision((value) => value + 1);
      return next;
    } catch (cause) {
      setError(toTicketUiError(cause, t, "action"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (ticketId) {
    return (
      <TicketDetailPanel
        basePath={basePath}
        busy={busy}
        detail={detail}
        error={error}
        id={`${id}.detail`}
        loading={loading}
        locale={locale}
        timeZone={timeZone}
        mode={mode}
        queues={queues}
        canManageAssignments={canManageAssignments}
        canTakeOver={canTakeOver}
        replyRevision={replyRevision}
        onBack={() => void navigate(basePath)}
        onRecover={() => setRevision((value) => value + 1)}
        onComment={async (values) => {
          if (!detail) return;
          const next = await perform(() =>
            addTicketComment(detail.id, {
              body: values.body,
              expectedVersion: detail.version,
              visibility: mode === "requester" ? "PUBLIC" : values.visibility,
            }),
          );
          if (next) setReplyRevision((value) => value + 1);
        }}
        onOpenLinked={(linkedTicketId) => void navigate(`${basePath}/tickets/${linkedTicketId}`)}
        onReopen={async () => {
          if (!detail) return;
          const next = await perform(() => reopenTicket(detail.id, detail.version));
          if (next && next.id !== detail.id) await navigate(`${basePath}/tickets/${next.id}`);
        }}
        onStatus={async (status) => {
          if (!detail) return;
          await perform(() =>
            changeTicketStatus(detail.id, { expectedVersion: detail.version, status }),
          );
        }}
        onAssign={async (nextQueueId, membershipId) => {
          if (!detail) return;
          await perform(() =>
            assignTicket(detail.id, {
              assigneeMembershipId: membershipId,
              expectedVersion: detail.version,
              queueId: nextQueueId,
            }),
          );
        }}
        onQueue={async (nextQueueId) => {
          if (!detail) return;
          await perform(() =>
            setTicketQueue(detail.id, {
              expectedVersion: detail.version,
              queueId: nextQueueId,
            }),
          );
        }}
        onRoundRobin={async (nextQueueId) => {
          if (!detail) return;
          await perform(() =>
            roundRobinTicket(detail.id, {
              expectedVersion: detail.version,
              queueId: nextQueueId,
            }),
          );
        }}
        onTakeOver={async () => {
          if (!detail) return;
          await perform(() => takeOverTicket(detail.id, detail.version));
        }}
        onUnassign={async () => {
          if (!detail) return;
          await perform(() => unassignTicket(detail.id, detail.version));
        }}
      />
    );
  }

  if (view === "create") {
    return (
      <TicketCreatePanel
        busy={busy}
        createRevision={createRevision}
        customers={customers}
        error={error}
        id={`${id}.create`}
        loading={loading}
        mode={mode}
        onBack={() => void navigate(basePath)}
        onCreate={async (values) => {
          if (mode === "staff" && !values.requesterContactId) {
            setError({
              kind: "validation",
              message: t("app:tickets.form.requesterRequired"),
              traceId: null,
            });
            return;
          }
          const next = await perform(() =>
            createTicket({
              description: values.description,
              priority: values.priority,
              requesterContactId: mode === "staff" ? values.requesterContactId : null,
              subject: values.subject,
            }),
          );
          if (next) {
            setCreateRevision((value) => value + 1);
            await navigate(`${basePath}/tickets/${next.id}`);
          }
        }}
      />
    );
  }

  return (
    <TicketListPanel
      error={error}
      id={`${id}.list`}
      loading={loading}
      locale={locale}
      timeZone={timeZone}
      mode={mode}
      query={listQuery}
      searchDraft={searchDraft}
      queues={queues}
      pageData={pageData}
      onOpen={(nextTicketId) => void navigate(`${basePath}/tickets/${nextTicketId}`)}
      onSearchDraft={(value) => setSearchDraftState({ source: listQuery.search, value })}
      onQuery={(changes) => {
        const next = { ...listQuery, ...changes };
        void navigate(
          { pathname: location.pathname, search: serializeTicketListQuery(next) },
          { replace: false },
        );
      }}
      onSearch={() => {
        const next = { ...listQuery, page: 1, search: searchDraft.trim().slice(0, 120) };
        void navigate(
          { pathname: location.pathname, search: serializeTicketListQuery(next) },
          { replace: false },
        );
      }}
      onReset={() => {
        setSearchDraftState({ source: "", value: "" });
        void navigate(
          { pathname: location.pathname, search: serializeTicketListQuery(defaultTicketListQuery) },
          { replace: false },
        );
      }}
      onRecover={() => setRevision((value) => value + 1)}
    />
  );
}

function TicketCreatePanel({
  busy,
  createRevision,
  customers,
  error,
  id,
  loading,
  mode,
  onBack,
  onCreate,
}: {
  readonly busy: boolean;
  readonly createRevision: number;
  readonly customers: readonly CustomerOption[];
  readonly error: TicketUiError | null;
  readonly id: string;
  readonly loading: boolean;
  readonly mode: "requester" | "staff";
  readonly onBack: () => void;
  readonly onCreate: (values: CreateTicketFormValues) => Promise<void>;
}) {
  const { t } = useAppTranslation();
  const controller = useMemo(() => createLilyFormController<CreateTicketFormValues>(), []);
  const definition = useMemo(() => createTicketFormDefinition(t), [t]);
  const bindings = useMemo<LilyFormBindings<CreateTicketFormValues>>(
    () => ({
      requesterContactId: {
        visible: mode === "staff",
        options: customers.flatMap((customer) =>
          customer.contacts.map((contact) => ({
            id: contact.id,
            label: `${customer.name} — ${contact.displayName} (${contact.email})`,
            value: contact.id,
          })),
        ),
      },
    }),
    [customers, mode],
  );

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:tickets.form.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t(`app:tickets.form.${mode}Description`)}
        </Typography>
      </Box>
      {error && (
        <Alert id={`${id}.error`} severity="error">
          {error.message}
        </Alert>
      )}
      {loading ? (
        <Alert id={`${id}.loading`} severity="info">
          {t("app:tickets.loading")}
        </Alert>
      ) : (
        <Box id={`${id}.form-wrap`} sx={{ maxWidth: 800 }}>
          <Card id={`${id}.form`} cardTitle={t("app:tickets.form.details")}>
            <LilyForm
              bindings={bindings}
              controller={controller}
              definition={definition}
              disabled={busy}
              initialValues={emptyCreateTicketValues}
              initialValuesRevision={createRevision}
              instanceId={`${id}.form.fields`}
              reinitialize="always"
              onSubmit={onCreate}
            />
          </Card>
        </Box>
      )}
      <Box id={`${id}.back-wrap`}>
        <Button id={`${id}.back`} variant="text" onClick={onBack}>
          {t("app:tickets.back")}
        </Button>
      </Box>
    </Stack>
  );
}

function TicketListPanel({
  error,
  id,
  loading,
  locale,
  mode,
  onOpen,
  onQuery,
  onRecover,
  onReset,
  onSearch,
  onSearchDraft,
  pageData,
  query,
  queues,
  searchDraft,
  timeZone,
}: {
  readonly error: TicketUiError | null;
  readonly id: string;
  readonly loading: boolean;
  readonly locale: string;
  readonly mode: "requester" | "staff";
  readonly onOpen: (ticketId: string) => void;
  readonly onQuery: (changes: Partial<TicketListQuery>) => void;
  readonly onRecover: () => void;
  readonly onReset: () => void;
  readonly onSearch: () => void;
  readonly onSearchDraft: (value: string) => void;
  readonly pageData: TicketPage | null;
  readonly query: TicketListQuery;
  readonly queues: readonly QueueView[];
  readonly searchDraft: string;
  readonly timeZone: string;
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
    pageData?.items.map((ticket) => ({
      id: ticket.id,
      assignee: ticket.assignee?.displayName ?? t("app:tickets.assignment.unassigned"),
      number: `#${ticket.number}`,
      priority: t(`app:tickets.priority.${ticket.priority}`),
      queue: ticket.queue?.name ?? t("app:tickets.assignment.noQueue"),
      requester: ticket.requester.displayName,
      status: t(`app:tickets.status.${ticket.status}`),
      subject: ticket.subject,
      updatedAt: formatDate(ticket.updatedAtUtc, locale, timeZone),
    })) ?? [];

  return (
    <Stack id={id} spacing={3}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h2" variant="h4">
          {t("app:tickets.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t(`app:tickets.${mode}.description`)}
        </Typography>
      </Box>
      {error && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {error.message}
            </Typography>
            {error.traceId && (
              <Typography id={`${id}.error.trace`} component="p" variant="body2">
                {t("app:tickets.errors.traceId")}: {error.traceId}
              </Typography>
            )}
            <Button id={`${id}.error.retry`} size="small" variant="outlined" onClick={onRecover}>
              {t("app:tickets.errors.retry")}
            </Button>
          </Stack>
        </Alert>
      )}
      <Card id={`${id}.filters`} cardTitle={t("app:tickets.filters.title")}>
        <Stack id={`${id}.filters.content`} spacing={2}>
          <Box
            id={`${id}.filters.search-form`}
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
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
                value={searchDraft}
                inputProps={{ maxLength: 120 }}
                onValueChange={onSearchDraft}
              />
              <Button id={`${id}.filters.search-submit`} type="submit" variant="contained">
                {t("app:tickets.filters.apply")}
              </Button>
              <Button id={`${id}.filters.reset`} type="button" variant="text" onClick={onReset}>
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
                  variant={query.assignment === value ? "contained" : "outlined"}
                  aria-pressed={query.assignment === value}
                  onClick={() => onQuery({ assignment: value, page: 1 })}
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
              value={query.status ?? "ALL"}
              options={[
                { id: "ALL", label: t("app:tickets.filters.allStatuses"), value: "ALL" },
                ...(["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"] as const).map((value) => ({
                  id: value,
                  label: t(`app:tickets.status.${value}`),
                  value,
                })),
              ]}
              onValueChange={(value) =>
                onQuery({ page: 1, status: value === "ALL" ? null : (value as TicketStatus) })
              }
            />
            <Select
              id={`${id}.filters.priority`}
              fullWidth
              label={t("app:tickets.filters.priority")}
              value={query.priority ?? "ALL"}
              options={[
                { id: "ALL", label: t("app:tickets.filters.allPriorities"), value: "ALL" },
                ...(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((value) => ({
                  id: value,
                  label: t(`app:tickets.priority.${value}`),
                  value,
                })),
              ]}
              onValueChange={(value) =>
                onQuery({ page: 1, priority: value === "ALL" ? null : (value as TicketPriority) })
              }
            />
            {mode === "staff" && (
              <Select
                id={`${id}.filters.queue`}
                fullWidth
                label={t("app:tickets.filters.queue")}
                value={query.queueId ?? "ALL"}
                options={[
                  { id: "ALL", label: t("app:tickets.filters.allQueues"), value: "ALL" },
                  ...queues.map((queue) => ({ id: queue.id, label: queue.name, value: queue.id })),
                ]}
                onValueChange={(value) =>
                  onQuery({ page: 1, queueId: value === "ALL" ? null : String(value) })
                }
              />
            )}
            <Select
              id={`${id}.filters.sort`}
              fullWidth
              label={t("app:tickets.filters.sort")}
              value={query.sortBy}
              options={(["updatedAt", "createdAt", "number", "priority"] as const).map((value) => ({
                id: value,
                label: t(`app:tickets.filters.sortBy.${value}`),
                value,
              }))}
              onValueChange={(value) => onQuery({ page: 1, sortBy: value as TicketSortField })}
            />
            <Select
              id={`${id}.filters.direction`}
              fullWidth
              label={t("app:tickets.filters.direction")}
              value={query.sortDirection}
              options={(["desc", "asc"] as const).map((value) => ({
                id: value,
                label: t(`app:tickets.filters.${value}`),
                value,
              }))}
              onValueChange={(value) =>
                onQuery({ page: 1, sortDirection: value as TicketSortDirection })
              }
            />
            <Select
              id={`${id}.filters.page-size`}
              fullWidth
              label={t("app:tickets.filters.pageSize")}
              value={query.pageSize}
              options={[10, 25, 50].map((value) => ({
                id: String(value),
                label: String(value),
                value,
              }))}
              onValueChange={(value) =>
                onQuery({ page: 1, pageSize: Number(value) as 10 | 25 | 50 })
              }
            />
          </Box>
        </Stack>
      </Card>
      <Table
        id={`${id}.table`}
        columns={columns as TableColumn[]}
        rows={rows}
        loading={loading}
        emptyContent={<Typography id={`${id}.empty`}>{t("app:tickets.empty")}</Typography>}
        getRowAriaLabel={(row) => `${t("app:tickets.open")} ${String(row.number)}`}
        pagination
        page={(pageData?.page ?? 1) - 1}
        rowsPerPage={pageData?.pageSize ?? 10}
        totalCount={pageData?.total ?? 0}
        onPageChange={(nextPage) => onQuery({ page: nextPage + 1 })}
        onRowActivate={(row) => onOpen(row.id)}
      />
    </Stack>
  );
}

function TicketDetailPanel({
  basePath,
  busy,
  canManageAssignments,
  canTakeOver,
  detail,
  error,
  id,
  loading,
  locale,
  mode,
  onAssign,
  onBack,
  onComment,
  onOpenLinked,
  onReopen,
  onQueue,
  onRecover,
  onRoundRobin,
  onStatus,
  onTakeOver,
  onUnassign,
  queues,
  replyRevision,
  timeZone,
}: {
  readonly basePath: string;
  readonly busy: boolean;
  readonly canManageAssignments: boolean;
  readonly canTakeOver: boolean;
  readonly detail: TicketDetail | null;
  readonly error: TicketUiError | null;
  readonly id: string;
  readonly loading: boolean;
  readonly locale: string;
  readonly mode: "requester" | "staff";
  readonly onBack: () => void;
  readonly onComment: (values: ReplyFormValues) => Promise<void>;
  readonly onOpenLinked: (ticketId: string) => void;
  readonly onAssign: (queueId: string, membershipId: string) => Promise<void>;
  readonly onQueue: (queueId: string) => Promise<void>;
  readonly onRecover: () => void;
  readonly onReopen: () => Promise<void>;
  readonly onRoundRobin: (queueId: string) => Promise<void>;
  readonly onStatus: (status: TicketStatus) => Promise<void>;
  readonly onTakeOver: () => Promise<void>;
  readonly onUnassign: () => Promise<void>;
  readonly queues: readonly QueueView[];
  readonly replyRevision: number;
  readonly timeZone: string;
}) {
  const { t } = useAppTranslation();
  const [composerVisibility, setComposerVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const controller = useMemo(() => createLilyFormController<ReplyFormValues>(), []);
  const definition = useMemo(
    () => replyFormDefinition(t, composerVisibility),
    [composerVisibility, t],
  );

  if (loading && !detail)
    return <Typography id={`${id}.loading`}>{t("app:tickets.loading")}</Typography>;
  if (!detail) {
    return (
      <Alert id={`${id}.missing`} severity="error">
        <Stack id={`${id}.missing.content`} spacing={1}>
          <Typography id={`${id}.missing.message`} component="p">
            {error?.message ?? t("app:tickets.loadError")}
          </Typography>
          <Button id={`${id}.missing.retry`} variant="outlined" onClick={onRecover}>
            {t("app:tickets.errors.retry")}
          </Button>
        </Stack>
      </Alert>
    );
  }
  const transitions = mode === "staff" ? STATUS_TRANSITIONS[detail.status] : [];
  return (
    <Stack id={id} spacing={3}>
      <Stack id={`${id}.navigation`} direction="row" spacing={1}>
        <Button id={`${id}.back`} variant="outlined" onClick={onBack}>
          {t("app:tickets.back")}
        </Button>
      </Stack>
      {error && (
        <Alert id={`${id}.error`} severity="error">
          <Stack id={`${id}.error.content`} spacing={1}>
            <Typography id={`${id}.error.message`} component="p">
              {error.message}
            </Typography>
            {error.traceId && (
              <Typography id={`${id}.error.trace`} component="p" variant="body2">
                {t("app:tickets.errors.traceId")}: {error.traceId}
              </Typography>
            )}
            {error.kind === "conflict" && (
              <Button id={`${id}.error.refresh`} variant="outlined" onClick={onRecover}>
                {t("app:tickets.errors.refresh")}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      <Card
        id={`${id}.summary`}
        cardTitle={`#${detail.number} — ${detail.subject}`}
        subheader={`${detail.requester.customerName} / ${detail.requester.displayName}`}
      >
        <Stack id={`${id}.summary.content`} spacing={2}>
          <Stack id={`${id}.badges`} direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              id={`${id}.status`}
              label={t(`app:tickets.status.${detail.status}`)}
              color="primary"
            />
            <Chip
              id={`${id}.priority`}
              label={t(`app:tickets.priority.${detail.priority}`)}
              variant="outlined"
            />
            <Chip id={`${id}.version`} label={`v${detail.version}`} variant="outlined" />
          </Stack>
          <Typography id={`${id}.description`} component="p" sx={{ whiteSpace: "pre-wrap" }}>
            {detail.description}
          </Typography>
          <Typography
            id={`${id}.updated`}
            component="p"
            variant="body2"
            sx={{ color: "text.secondary" }}
          >
            {t("app:tickets.updatedAt")}: {formatDate(detail.updatedAtUtc, locale, timeZone)}
          </Typography>
        </Stack>
      </Card>
      <Box
        id={`${id}.service-context`}
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Card id={`${id}.ownership`} cardTitle={t("app:tickets.context.title")}>
          <Stack id={`${id}.ownership.content`} spacing={1}>
            <Typography id={`${id}.ownership.queue`} component="p">
              <strong>{t("app:tickets.assignment.queue")}:</strong>{" "}
              {detail.queue?.name ?? t("app:tickets.assignment.noQueue")}
            </Typography>
            <Typography id={`${id}.ownership.assignee`} component="p">
              <strong>{t("app:tickets.assignment.assignee")}:</strong>{" "}
              {detail.assignee?.displayName ?? t("app:tickets.assignment.unassigned")}
            </Typography>
            <Typography id={`${id}.ownership.created`} component="p" variant="body2">
              {t("app:tickets.context.createdAt")}:{" "}
              {formatDate(detail.createdAtUtc, locale, timeZone)}
            </Typography>
          </Stack>
        </Card>
        <Card id={`${id}.sla`} cardTitle={t("app:tickets.sla.title")}>
          <Alert id={`${id}.sla.placeholder`} severity="info">
            {t("app:tickets.sla.notConfigured")}
          </Alert>
          <Typography id={`${id}.sla.time-zone`} component="p" variant="body2" sx={{ mt: 1 }}>
            {t("app:tickets.context.timeZone")}: {timeZone}
          </Typography>
        </Card>
      </Box>
      {mode === "staff" && (
        <Card id={`${id}.assignment`} cardTitle={t("app:tickets.assignment.title")}>
          <Stack id={`${id}.assignment.content`} spacing={2}>
            <Typography id={`${id}.assignment.current`} component="p">
              {t("app:tickets.assignment.queue")}:{" "}
              {detail.queue?.name ?? t("app:tickets.assignment.noQueue")} ·{" "}
              {t("app:tickets.assignment.assignee")}:{" "}
              {detail.assignee?.displayName ?? t("app:tickets.assignment.unassigned")}
            </Typography>
            {canTakeOver && detail.queue && (
              <Button
                id={`${id}.assignment.take-over`}
                disabled={busy}
                variant="contained"
                onClick={() => void onTakeOver()}
              >
                {t("app:tickets.assignment.takeOver")}
              </Button>
            )}
            {canManageAssignments && (
              <Stack id={`${id}.assignment.management`} spacing={2}>
                {detail.assignee && (
                  <Button
                    id={`${id}.assignment.unassign`}
                    disabled={busy}
                    color="warning"
                    variant="outlined"
                    onClick={() => void onUnassign()}
                  >
                    {t("app:tickets.assignment.unassign")}
                  </Button>
                )}
                {queues
                  .filter((queue) => queue.status === "ACTIVE")
                  .map((queue) => (
                    <Box
                      key={queue.id}
                      id={`${id}.assignment.queue.${queue.id}`}
                      sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}
                    >
                      <Typography
                        id={`${id}.assignment.queue.${queue.id}.title`}
                        component="h3"
                        variant="h6"
                      >
                        {queue.name}
                      </Typography>
                      <Stack
                        id={`${id}.assignment.queue.${queue.id}.actions`}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ mt: 1, flexWrap: "wrap" }}
                      >
                        <Button
                          id={`${id}.assignment.queue.${queue.id}.place`}
                          disabled={busy}
                          variant="outlined"
                          onClick={() => void onQueue(queue.id)}
                        >
                          {t("app:tickets.assignment.place")}
                        </Button>
                        <Button
                          id={`${id}.assignment.queue.${queue.id}.round-robin`}
                          disabled={busy || queue.activeMemberCount === 0}
                          variant="outlined"
                          onClick={() => void onRoundRobin(queue.id)}
                        >
                          {t("app:tickets.assignment.roundRobin")}
                        </Button>
                        {queue.members
                          .filter((member) => member.status === "ACTIVE")
                          .map((member) => (
                            <Button
                              key={member.membershipId}
                              id={`${id}.assignment.queue.${queue.id}.member.${member.membershipId}`}
                              disabled={busy}
                              variant="text"
                              onClick={() => void onAssign(queue.id, member.membershipId)}
                            >
                              {t("app:tickets.assignment.assignTo")} {member.displayName}
                            </Button>
                          ))}
                      </Stack>
                    </Box>
                  ))}
              </Stack>
            )}
          </Stack>
        </Card>
      )}
      {mode === "staff" &&
        (transitions.length > 0 || detail.status === "RESOLVED" || detail.status === "CLOSED") && (
          <Card id={`${id}.workflow`} cardTitle={t("app:tickets.workflow")}>
            <Stack
              id={`${id}.workflow.actions`}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
            >
              {transitions.map((status) => (
                <Button
                  key={status}
                  id={`${id}.status.${status}`}
                  disabled={busy}
                  variant="outlined"
                  onClick={() => void onStatus(status)}
                >
                  {t(`app:tickets.status.${status}`)}
                </Button>
              ))}
              {(detail.status === "RESOLVED" || detail.status === "CLOSED") && (
                <Button
                  id={`${id}.reopen`}
                  disabled={busy}
                  variant="contained"
                  onClick={() => void onReopen()}
                >
                  {t("app:tickets.reopen")}
                </Button>
              )}
            </Stack>
          </Card>
        )}
      <Box id={`${id}.timeline`}>
        <Typography id={`${id}.timeline.title`} component="h2" variant="h5" sx={{ mb: 2 }}>
          {t("app:tickets.timeline")}
        </Typography>
        <Stack
          id={`${id}.comments`}
          component="ol"
          spacing={2}
          sx={{ listStyle: "none", m: 0, p: 0 }}
        >
          {detail.comments.length === 0 && (
            <Alert id={`${id}.comments.empty`} severity="info">
              {t("app:tickets.noComments")}
            </Alert>
          )}
          {detail.comments.map((comment) => (
            <Card
              key={comment.id}
              id={`${id}.comment.${comment.id}`}
              component="li"
              cardTitle={comment.author.displayName}
              subheader={formatDate(comment.createdAtUtc, locale, timeZone)}
              {...(comment.visibility === "INTERNAL"
                ? {
                    sx: {
                      border: 2,
                      borderColor: "warning.main",
                      bgcolor: "action.hover",
                    },
                  }
                : { sx: { borderLeft: 4, borderColor: "success.main" } })}
              headerAction={
                <Chip
                  id={`${id}.comment.${comment.id}.visibility`}
                  size="small"
                  color={comment.visibility === "INTERNAL" ? "warning" : "success"}
                  label={t(
                    `app:tickets.reply.${comment.visibility === "INTERNAL" ? "internal" : "public"}`,
                  )}
                />
              }
            >
              <Typography
                id={`${id}.comment.${comment.id}.body`}
                component="p"
                sx={{ whiteSpace: "pre-wrap" }}
              >
                {comment.body}
              </Typography>
            </Card>
          ))}
        </Stack>
      </Box>
      {mode === "staff" && detail.assignmentHistory.length > 0 && (
        <Box id={`${id}.assignment-history`}>
          <Typography
            id={`${id}.assignment-history.title`}
            component="h2"
            variant="h5"
            sx={{ mb: 2 }}
          >
            {t("app:tickets.assignment.history")}
          </Typography>
          <Stack id={`${id}.assignment-history.items`} spacing={1}>
            {detail.assignmentHistory.map((entry) => (
              <Card
                key={entry.id}
                id={`${id}.assignment-history.${entry.id}`}
                cardTitle={t(`app:tickets.assignment.action.${entry.action}`)}
                subheader={`${entry.actor.displayName} · ${formatDate(entry.occurredAtUtc, locale, timeZone)}`}
              >
                <Typography id={`${id}.assignment-history.${entry.id}.change`} component="p">
                  {entry.fromQueue?.name ?? "—"} / {entry.fromAssignee?.displayName ?? "—"} →{" "}
                  {entry.toQueue?.name ?? "—"} / {entry.toAssignee?.displayName ?? "—"}
                </Typography>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
      {mode === "staff" && detail.statusHistory.length > 0 && (
        <Box id={`${id}.status-history`}>
          <Typography id={`${id}.status-history.title`} component="h2" variant="h5" sx={{ mb: 2 }}>
            {t("app:tickets.statusHistory")}
          </Typography>
          <Stack id={`${id}.status-history.items`} spacing={1}>
            {detail.statusHistory.map((entry) => (
              <Card
                key={entry.id}
                id={`${id}.status-history.${entry.id}`}
                cardTitle={`${entry.fromStatus ? t(`app:tickets.status.${entry.fromStatus}`) : "—"} → ${t(`app:tickets.status.${entry.toStatus}`)}`}
                subheader={`${entry.actor.displayName} · ${formatDate(entry.occurredAtUtc, locale, timeZone)}`}
              >
                <Typography
                  id={`${id}.status-history.${entry.id}.version`}
                  component="p"
                  variant="body2"
                >
                  v{entry.version}
                </Typography>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
      {(detail.reopenedFrom || detail.reopenedTickets.length > 0) && (
        <Card id={`${id}.linked`} cardTitle={t("app:tickets.linked.title")}>
          <Stack id={`${id}.linked.items`} direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {detail.reopenedFrom && (
              <Button
                id={`${id}.linked.from`}
                variant="outlined"
                onClick={() => onOpenLinked(detail.reopenedFrom?.id ?? "")}
              >
                {t("app:tickets.linked.previous")} #{detail.reopenedFrom.number}
              </Button>
            )}
            {detail.reopenedTickets.map((ticket) => (
              <Button
                key={ticket.id}
                id={`${id}.linked.${ticket.id}`}
                variant="outlined"
                onClick={() => onOpenLinked(ticket.id)}
              >
                {t("app:tickets.linked.reopened")} #{ticket.number}
              </Button>
            ))}
          </Stack>
        </Card>
      )}
      {detail.status !== "CLOSED" && (
        <>
          <Divider id={`${id}.reply.divider`} />
          {mode === "staff" && (
            <Stack id={`${id}.reply.mode`} direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                id={`${id}.reply.mode.public`}
                variant={composerVisibility === "PUBLIC" ? "contained" : "outlined"}
                aria-pressed={composerVisibility === "PUBLIC"}
                onClick={() => setComposerVisibility("PUBLIC")}
              >
                {t("app:tickets.reply.public")}
              </Button>
              <Button
                id={`${id}.reply.mode.internal`}
                color="warning"
                variant={composerVisibility === "INTERNAL" ? "contained" : "outlined"}
                aria-pressed={composerVisibility === "INTERNAL"}
                onClick={() => setComposerVisibility("INTERNAL")}
              >
                {t("app:tickets.reply.internal")}
              </Button>
            </Stack>
          )}
          <Card
            id={`${id}.reply`}
            cardTitle={t(
              `app:tickets.reply.${composerVisibility === "INTERNAL" ? "internalTitle" : "publicTitle"}`,
            )}
            sx={
              composerVisibility === "INTERNAL"
                ? { border: 2, borderColor: "warning.main" }
                : { border: 2, borderColor: "success.main" }
            }
          >
            <Alert
              id={`${id}.reply.notice`}
              severity={composerVisibility === "INTERNAL" ? "warning" : "success"}
              sx={{ mb: 2 }}
            >
              {t(
                `app:tickets.reply.${composerVisibility === "INTERNAL" ? "internalNotice" : "publicNotice"}`,
              )}
            </Alert>
            <LilyForm
              controller={controller}
              definition={definition}
              disabled={busy}
              initialValues={{ ...emptyReplyValues, visibility: composerVisibility }}
              initialValuesRevision={
                replyRevision * 2 + (composerVisibility === "INTERNAL" ? 1 : 0)
              }
              instanceId={`${id}.reply.form`}
              reinitialize="always"
              onSubmit={onComment}
            />
          </Card>
        </>
      )}
      <Box id={`${id}.route-meta`} sx={{ display: "none" }}>
        {basePath}
      </Box>
    </Stack>
  );
}

function formatDate(value: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function toTicketUiError(
  cause: unknown,
  t: (key: string) => string,
  operation: "action" | "load",
): TicketUiError {
  const error = normalizeError(cause);
  const traceId = cause instanceof LilyApiError ? (cause.traceId ?? null) : null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { kind: "network", message: t("app:tickets.errors.offline"), traceId };
  }
  if (cause instanceof LilyNetworkError) {
    return { kind: "network", message: t("app:tickets.errors.network"), traceId };
  }
  if (error.statusCode === 409) {
    return { kind: "conflict", message: t("app:tickets.errors.conflict"), traceId };
  }
  if (error.statusCode === 403) {
    return { kind: "forbidden", message: t("app:tickets.errors.forbidden"), traceId };
  }
  if (error.statusCode === 400 || error.statusCode === 422) {
    return { kind: "validation", message: t("app:tickets.errors.validation"), traceId };
  }
  return {
    kind: "unknown",
    message: t(operation === "load" ? "app:tickets.loadError" : "app:tickets.actionError"),
    traceId,
  };
}
