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

export function listTickets(page: number, signal?: AbortSignal): Promise<TicketPage> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: "10",
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
  return appHttpClient.getData<TicketPage>(`/api/v1/tickets?${query.toString()}`, {
    decode: decodeTicketPage,
    metadata: { operationName: "tickets.list" },
    ...(signal ? { signal } : {}),
  });
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
