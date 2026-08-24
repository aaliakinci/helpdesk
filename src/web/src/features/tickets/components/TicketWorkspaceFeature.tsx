import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Card } from "@lily_platform/lily_ui/ui/atoms/Card";
import { Chip } from "@lily_platform/lily_ui/ui/atoms/Chip";
import { Divider } from "@lily_platform/lily_ui/ui/atoms/Divider";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Table, type TableColumn, type TableRowData } from "@lily_platform/lily_ui/ui/atoms/Table";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import {
  createLilyFormController,
  LilyForm,
  type LilyFormBindings,
} from "@lily_platform/lily_ui/ui/forms";
import { useEffect, useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import {
  addTicketComment,
  changeTicketStatus,
  createTicket,
  getTicket,
  listCustomers,
  listTickets,
  reopenTicket,
} from "../api/ticketApi";
import type { CustomerOption, TicketDetail, TicketPage, TicketStatus } from "../api/ticketContract";
import {
  createTicketFormDefinition,
  emptyCreateTicketValues,
  emptyReplyValues,
  replyFormDefinition,
  type CreateTicketFormValues,
  type ReplyFormValues,
} from "../model/ticketForms";

interface TicketWorkspaceFeatureProps {
  readonly id: string;
  readonly mode: "requester" | "staff";
  readonly ticketId?: string | undefined;
}

interface TicketRow extends TableRowData {
  readonly number: string;
  readonly priority: string;
  readonly requester: string;
  readonly status: string;
  readonly subject: string;
  readonly updatedAt: string;
}

const STATUS_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "PENDING", "RESOLVED"],
  OPEN: ["PENDING", "RESOLVED"],
  PENDING: ["OPEN", "RESOLVED"],
  RESOLVED: [],
  CLOSED: [],
};

export function TicketWorkspaceFeature({ id, mode, ticketId }: TicketWorkspaceFeatureProps) {
  const navigate = useLilyNavigate();
  const { locale, t } = useAppTranslation();
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<TicketPage | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [customers, setCustomers] = useState<readonly CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [createRevision, setCreateRevision] = useState(0);
  const [replyRevision, setReplyRevision] = useState(0);
  const basePath = mode === "requester" ? "/portal" : "/workspace";

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
          setDetail(await getTicket(ticketId, controller.signal));
        } else {
          const [tickets, customerOptions] = await Promise.all([
            listTickets(page, controller.signal),
            mode === "staff" ? listCustomers(controller.signal) : Promise.resolve([]),
          ]);
          setPageData(tickets);
          setCustomers(customerOptions);
        }
      } catch {
        if (!controller.signal.aborted) setError(t("app:tickets.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [mode, page, revision, t, ticketId]);

  async function perform(action: () => Promise<TicketDetail>): Promise<TicketDetail | null> {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setDetail(next);
      setRevision((value) => value + 1);
      return next;
    } catch {
      setError(t("app:tickets.actionError"));
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
        mode={mode}
        replyRevision={replyRevision}
        onBack={() => void navigate(basePath)}
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
      />
    );
  }

  return (
    <TicketListPanel
      busy={busy}
      createRevision={createRevision}
      customers={customers}
      error={error}
      id={`${id}.list`}
      loading={loading}
      locale={locale}
      mode={mode}
      pageData={pageData}
      onCreate={async (values) => {
        if (mode === "staff" && !values.requesterContactId) {
          setError(t("app:tickets.form.requesterRequired"));
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
      onOpen={(nextTicketId) => void navigate(`${basePath}/tickets/${nextTicketId}`)}
      onPage={(nextPage) => setPage(nextPage)}
    />
  );
}

function TicketListPanel({
  busy,
  createRevision,
  customers,
  error,
  id,
  loading,
  locale,
  mode,
  onCreate,
  onOpen,
  onPage,
  pageData,
}: {
  readonly busy: boolean;
  readonly createRevision: number;
  readonly customers: readonly CustomerOption[];
  readonly error: string | null;
  readonly id: string;
  readonly loading: boolean;
  readonly locale: string;
  readonly mode: "requester" | "staff";
  readonly onCreate: (values: CreateTicketFormValues) => Promise<void>;
  readonly onOpen: (ticketId: string) => void;
  readonly onPage: (page: number) => void;
  readonly pageData: TicketPage | null;
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
  const columns = useMemo<readonly TableColumn<TicketRow>[]>(
    () => [
      { id: "number", label: t("app:tickets.columns.number"), priority: "primary" },
      { id: "subject", label: t("app:tickets.columns.subject"), priority: "primary" },
      { id: "status", label: t("app:tickets.columns.status"), priority: "secondary" },
      { id: "priority", label: t("app:tickets.columns.priority"), priority: "secondary" },
      { id: "requester", label: t("app:tickets.columns.requester"), priority: "tertiary" },
      { id: "updatedAt", label: t("app:tickets.columns.updated"), priority: "tertiary" },
    ],
    [t],
  );
  const rows: TicketRow[] =
    pageData?.items.map((ticket) => ({
      id: ticket.id,
      number: `#${ticket.number}`,
      priority: t(`app:tickets.priority.${ticket.priority}`),
      requester: ticket.requester.displayName,
      status: t(`app:tickets.status.${ticket.status}`),
      subject: ticket.subject,
      updatedAt: formatDate(ticket.updatedAtUtc, locale),
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
          {error}
        </Alert>
      )}
      <Card id={`${id}.create`} cardTitle={t("app:tickets.form.title")}>
        <LilyForm
          bindings={bindings}
          controller={controller}
          definition={definition}
          disabled={busy}
          initialValues={emptyCreateTicketValues}
          initialValuesRevision={createRevision}
          instanceId={`${id}.create.form`}
          reinitialize="always"
          onSubmit={onCreate}
        />
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
        onPageChange={(nextPage) => onPage(nextPage + 1)}
        onRowActivate={(row) => onOpen(row.id)}
      />
    </Stack>
  );
}

function TicketDetailPanel({
  basePath,
  busy,
  detail,
  error,
  id,
  loading,
  locale,
  mode,
  onBack,
  onComment,
  onReopen,
  onStatus,
  replyRevision,
}: {
  readonly basePath: string;
  readonly busy: boolean;
  readonly detail: TicketDetail | null;
  readonly error: string | null;
  readonly id: string;
  readonly loading: boolean;
  readonly locale: string;
  readonly mode: "requester" | "staff";
  readonly onBack: () => void;
  readonly onComment: (values: ReplyFormValues) => Promise<void>;
  readonly onReopen: () => Promise<void>;
  readonly onStatus: (status: TicketStatus) => Promise<void>;
  readonly replyRevision: number;
}) {
  const { t } = useAppTranslation();
  const controller = useMemo(() => createLilyFormController<ReplyFormValues>(), []);
  const definition = useMemo(() => replyFormDefinition(t), [t]);
  const bindings = useMemo<LilyFormBindings<ReplyFormValues>>(
    () => ({ visibility: { visible: mode === "staff" } }),
    [mode],
  );

  if (loading && !detail)
    return <Typography id={`${id}.loading`}>{t("app:tickets.loading")}</Typography>;
  if (!detail) {
    return (
      <Alert id={`${id}.missing`} severity="error">
        {error ?? t("app:tickets.loadError")}
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
          {error}
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
            {t("app:tickets.updatedAt")}: {formatDate(detail.updatedAtUtc, locale)}
          </Typography>
        </Stack>
      </Card>
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
        <Stack id={`${id}.comments`} spacing={2}>
          {detail.comments.length === 0 && (
            <Alert id={`${id}.comments.empty`} severity="info">
              {t("app:tickets.noComments")}
            </Alert>
          )}
          {detail.comments.map((comment) => (
            <Card
              key={comment.id}
              id={`${id}.comment.${comment.id}`}
              cardTitle={comment.author.displayName}
              subheader={formatDate(comment.createdAtUtc, locale)}
              {...(comment.visibility === "INTERNAL"
                ? { sx: { border: 1, borderColor: "warning.main" } }
                : {})}
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
      {detail.status !== "CLOSED" && (
        <>
          <Divider id={`${id}.reply.divider`} />
          <Card id={`${id}.reply`} cardTitle={t("app:tickets.reply.title")}>
            <LilyForm
              bindings={bindings}
              controller={controller}
              definition={definition}
              disabled={busy}
              initialValues={emptyReplyValues}
              initialValuesRevision={replyRevision}
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

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
