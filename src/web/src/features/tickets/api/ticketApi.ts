import { appHttpClient } from "@/shared/api";

import {
  decodeCustomers,
  decodeTicketDetail,
  decodeTicketPage,
  type CreateTicketRequest,
  type CustomerOption,
  type TicketCommentVisibility,
  type TicketDetail,
  type TicketPage,
  type TicketStatus,
} from "./ticketContract";

const mutationMetadata = { operationName: "tickets.mutation", replay: "deny" as const };

export interface TicketListFilters {
  readonly assignment: "ALL" | "MINE" | "UNASSIGNED";
  readonly queueId: string | null;
}

export function listTickets(
  page: number,
  filters: TicketListFilters,
  signal?: AbortSignal,
): Promise<TicketPage> {
  const query = new URLSearchParams({
    assignment: filters.assignment,
    page: String(page),
    pageSize: "10",
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
  if (filters.queueId) query.set("queueId", filters.queueId);
  return appHttpClient.getData<TicketPage>(`/api/v1/tickets?${query.toString()}`, {
    decode: decodeTicketPage,
    metadata: { operationName: "tickets.list" },
    ...(signal ? { signal } : {}),
  });
}

export function setTicketQueue(
  ticketId: string,
  request: { readonly expectedVersion: number; readonly queueId: string },
): Promise<TicketDetail> {
  return assignmentMutation(ticketId, "queue", request, "tickets.set-queue");
}

export function assignTicket(
  ticketId: string,
  request: {
    readonly assigneeMembershipId: string;
    readonly expectedVersion: number;
    readonly queueId: string;
  },
): Promise<TicketDetail> {
  return assignmentMutation(ticketId, "assign", request, "tickets.assign");
}

export function unassignTicket(ticketId: string, expectedVersion: number): Promise<TicketDetail> {
  return assignmentMutation(ticketId, "unassign", { expectedVersion }, "tickets.unassign");
}

export function takeOverTicket(ticketId: string, expectedVersion: number): Promise<TicketDetail> {
  return assignmentMutation(ticketId, "take-over", { expectedVersion }, "tickets.take-over");
}

export function roundRobinTicket(
  ticketId: string,
  request: { readonly expectedVersion: number; readonly queueId: string },
): Promise<TicketDetail> {
  return assignmentMutation(ticketId, "round-robin", request, "tickets.round-robin");
}

export function getTicket(ticketId: string, signal?: AbortSignal): Promise<TicketDetail> {
  return appHttpClient.getData<TicketDetail>(`/api/v1/tickets/${ticketId}`, {
    decode: decodeTicketDetail,
    metadata: { operationName: "tickets.detail" },
    ...(signal ? { signal } : {}),
  });
}

export function createTicket(request: CreateTicketRequest): Promise<TicketDetail> {
  return appHttpClient.postData<TicketDetail, CreateTicketRequest>("/api/v1/tickets", request, {
    decode: decodeTicketDetail,
    metadata: { ...mutationMetadata, operationName: "tickets.create" },
  });
}

export function addTicketComment(
  ticketId: string,
  request: {
    readonly body: string;
    readonly expectedVersion: number;
    readonly visibility: TicketCommentVisibility;
  },
): Promise<TicketDetail> {
  return appHttpClient.postData<TicketDetail, typeof request>(
    `/api/v1/tickets/${ticketId}/comments`,
    request,
    {
      decode: decodeTicketDetail,
      metadata: { ...mutationMetadata, operationName: "tickets.comment" },
    },
  );
}

export function changeTicketStatus(
  ticketId: string,
  request: { readonly expectedVersion: number; readonly status: TicketStatus },
): Promise<TicketDetail> {
  return appHttpClient.patchData<TicketDetail, typeof request>(
    `/api/v1/tickets/${ticketId}/status`,
    request,
    {
      decode: decodeTicketDetail,
      metadata: { ...mutationMetadata, operationName: "tickets.change-status" },
    },
  );
}

export function reopenTicket(ticketId: string, expectedVersion: number): Promise<TicketDetail> {
  return appHttpClient.postData<TicketDetail, { readonly expectedVersion: number }>(
    `/api/v1/tickets/${ticketId}/reopen`,
    { expectedVersion },
    {
      decode: decodeTicketDetail,
      metadata: { ...mutationMetadata, operationName: "tickets.reopen" },
    },
  );
}

export function listCustomers(signal?: AbortSignal): Promise<readonly CustomerOption[]> {
  return appHttpClient.getData<readonly CustomerOption[]>("/api/v1/customers", {
    decode: decodeCustomers,
    metadata: { operationName: "customers.list-for-ticket" },
    ...(signal ? { signal } : {}),
  });
}

function assignmentMutation<Request>(
  ticketId: string,
  action: "assign" | "queue" | "round-robin" | "take-over" | "unassign",
  request: Request,
  operationName: string,
): Promise<TicketDetail> {
  return appHttpClient.postData<TicketDetail, Request>(
    `/api/v1/tickets/${ticketId}/${action}`,
    request,
    {
      decode: decodeTicketDetail,
      metadata: { ...mutationMetadata, operationName },
    },
  );
}
