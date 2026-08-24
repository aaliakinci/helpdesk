import type {
  TicketCommentVisibility,
  TicketPriority,
  TicketStatus,
} from "../domain/ticket-policy.js";

export interface CustomerSummary {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly contacts: readonly CustomerContactSummary[];
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface CustomerContactSummary {
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly userId: string | null;
}

export interface CustomerHistoryItem {
  readonly action: string;
  readonly actorUserId: string;
  readonly changes: unknown;
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly subjectId: string;
  readonly subjectType: string;
}

export interface TicketRequester {
  readonly customerId: string;
  readonly customerName: string;
  readonly contactId: string;
  readonly displayName: string;
  readonly email: string;
}

export interface TicketSummary {
  readonly createdAtUtc: string;
  readonly firstResponseAtUtc: string | null;
  readonly id: string;
  readonly number: number;
  readonly priority: TicketPriority;
  readonly requester: TicketRequester;
  readonly status: TicketStatus;
  readonly subject: string;
  readonly updatedAtUtc: string;
  readonly version: number;
}

export interface TicketCommentView {
  readonly author: { readonly displayName: string; readonly id: string };
  readonly body: string;
  readonly createdAtUtc: string;
  readonly id: string;
  readonly visibility: TicketCommentVisibility;
}

export interface TicketStatusHistoryView {
  readonly actor: { readonly displayName: string; readonly id: string };
  readonly fromStatus: TicketStatus | null;
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly toStatus: TicketStatus;
  readonly version: number;
}

export interface TicketDetail extends TicketSummary {
  readonly closedAtUtc: string | null;
  readonly comments: readonly TicketCommentView[];
  readonly description: string;
  readonly reopenedFrom: { readonly id: string; readonly number: number } | null;
  readonly reopenedTickets: readonly { readonly id: string; readonly number: number }[];
  readonly resolvedAtUtc: string | null;
  readonly statusHistory: readonly TicketStatusHistoryView[];
  readonly tags: readonly { readonly id: string; readonly name: string }[];
}

export interface TicketPage {
  readonly items: readonly TicketSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface TicketListInput {
  readonly page: number;
  readonly pageSize: number;
  readonly priority: TicketPriority | null;
  readonly sortBy: "createdAt" | "number" | "priority" | "updatedAt";
  readonly sortDirection: "asc" | "desc";
  readonly status: TicketStatus | null;
}
