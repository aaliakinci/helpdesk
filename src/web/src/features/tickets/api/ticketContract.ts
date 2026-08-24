import {
  nullableString,
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export type TicketStatus = "NEW" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TicketCommentVisibility = "PUBLIC" | "INTERNAL";

export interface TicketRequester {
  readonly contactId: string;
  readonly customerId: string;
  readonly customerName: string;
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

export interface TicketComment {
  readonly author: { readonly displayName: string; readonly id: string };
  readonly body: string;
  readonly createdAtUtc: string;
  readonly id: string;
  readonly visibility: TicketCommentVisibility;
}

export interface TicketDetail extends TicketSummary {
  readonly closedAtUtc: string | null;
  readonly comments: readonly TicketComment[];
  readonly description: string;
  readonly reopenedFrom: { readonly id: string; readonly number: number } | null;
  readonly reopenedTickets: readonly { readonly id: string; readonly number: number }[];
  readonly resolvedAtUtc: string | null;
  readonly statusHistory: readonly {
    readonly actor: { readonly displayName: string; readonly id: string };
    readonly fromStatus: TicketStatus | null;
    readonly id: string;
    readonly occurredAtUtc: string;
    readonly toStatus: TicketStatus;
    readonly version: number;
  }[];
  readonly tags: readonly { readonly id: string; readonly name: string }[];
}

export interface TicketPage {
  readonly items: readonly TicketSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CustomerOption {
  readonly contacts: readonly {
    readonly displayName: string;
    readonly email: string;
    readonly id: string;
  }[];
  readonly id: string;
  readonly name: string;
}

export interface CreateTicketRequest {
  readonly description: string;
  readonly priority: TicketPriority;
  readonly requesterContactId: string | null;
  readonly subject: string;
}

const STATUSES: readonly TicketStatus[] = ["NEW", "OPEN", "PENDING", "RESOLVED", "CLOSED"];
const PRIORITIES: readonly TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const VISIBILITIES: readonly TicketCommentVisibility[] = ["PUBLIC", "INTERNAL"];

export function decodeTicketPage(body: unknown): TicketPage {
  const value = requireRecord(body, "ticket page");
  return {
    items: requireArray(value.items, "ticket items").map(decodeTicketSummary),
    page: requireNumber(value.page, "page"),
    pageSize: requireNumber(value.pageSize, "pageSize"),
    total: requireNumber(value.total, "total"),
    totalPages: requireNumber(value.totalPages, "totalPages"),
  };
}

export function decodeTicketDetail(body: unknown): TicketDetail {
  const value = requireRecord(body, "ticket detail");
  return {
    ...decodeTicketSummary(body),
    closedAtUtc: nullableString(value.closedAtUtc, "closedAtUtc"),
    comments: requireArray(value.comments, "comments").map((item) => {
      const comment = requireRecord(item, "comment");
      return {
        author: decodePerson(comment.author),
        body: requireString(comment.body, "comment.body"),
        createdAtUtc: requireString(comment.createdAtUtc, "comment.createdAtUtc"),
        id: requireString(comment.id, "comment.id"),
        visibility: decodeVisibility(comment.visibility),
      };
    }),
    description: requireString(value.description, "description"),
    reopenedFrom: value.reopenedFrom === null ? null : decodeTicketLink(value.reopenedFrom),
    reopenedTickets: requireArray(value.reopenedTickets, "reopenedTickets").map(decodeTicketLink),
    resolvedAtUtc: nullableString(value.resolvedAtUtc, "resolvedAtUtc"),
    statusHistory: requireArray(value.statusHistory, "statusHistory").map((item) => {
      const history = requireRecord(item, "status history");
      return {
        actor: decodePerson(history.actor),
        fromStatus: history.fromStatus === null ? null : decodeStatus(history.fromStatus),
        id: requireString(history.id, "history.id"),
        occurredAtUtc: requireString(history.occurredAtUtc, "history.occurredAtUtc"),
        toStatus: decodeStatus(history.toStatus),
        version: requireNumber(history.version, "history.version"),
      };
    }),
    tags: requireArray(value.tags, "tags").map((item) => {
      const tag = requireRecord(item, "tag");
      return { id: requireString(tag.id, "tag.id"), name: requireString(tag.name, "tag.name") };
    }),
  };
}

export function decodeCustomers(body: unknown): readonly CustomerOption[] {
  return requireArray(body, "customers").map((item) => {
    const customer = requireRecord(item, "customer");
    return {
      contacts: requireArray(customer.contacts, "customer.contacts").map((contactBody) => {
        const contact = requireRecord(contactBody, "contact");
        return {
          displayName: requireString(contact.displayName, "contact.displayName"),
          email: requireString(contact.email, "contact.email"),
          id: requireString(contact.id, "contact.id"),
        };
      }),
      id: requireString(customer.id, "customer.id"),
      name: requireString(customer.name, "customer.name"),
    };
  });
}

function decodeTicketSummary(body: unknown): TicketSummary {
  const value = requireRecord(body, "ticket");
  const requester = requireRecord(value.requester, "ticket.requester");
  return {
    createdAtUtc: requireString(value.createdAtUtc, "ticket.createdAtUtc"),
    firstResponseAtUtc: nullableString(value.firstResponseAtUtc, "ticket.firstResponseAtUtc"),
    id: requireString(value.id, "ticket.id"),
    number: requireNumber(value.number, "ticket.number"),
    priority: decodePriority(value.priority),
    requester: {
      contactId: requireString(requester.contactId, "requester.contactId"),
      customerId: requireString(requester.customerId, "requester.customerId"),
      customerName: requireString(requester.customerName, "requester.customerName"),
      displayName: requireString(requester.displayName, "requester.displayName"),
      email: requireString(requester.email, "requester.email"),
    },
    status: decodeStatus(value.status),
    subject: requireString(value.subject, "ticket.subject"),
    updatedAtUtc: requireString(value.updatedAtUtc, "ticket.updatedAtUtc"),
    version: requireNumber(value.version, "ticket.version"),
  };
}

function decodeTicketLink(body: unknown): { readonly id: string; readonly number: number } {
  const value = requireRecord(body, "ticket link");
  return {
    id: requireString(value.id, "ticket link id"),
    number: requireNumber(value.number, "ticket link number"),
  };
}

function decodePerson(body: unknown): { readonly displayName: string; readonly id: string } {
  const value = requireRecord(body, "person");
  return {
    displayName: requireString(value.displayName, "person.displayName"),
    id: requireString(value.id, "person.id"),
  };
}

function decodeStatus(value: unknown): TicketStatus {
  if (typeof value !== "string" || !STATUSES.includes(value as TicketStatus)) {
    throw new TypeError("ticket.status is invalid.");
  }
  return value as TicketStatus;
}

function decodePriority(value: unknown): TicketPriority {
  if (typeof value !== "string" || !PRIORITIES.includes(value as TicketPriority)) {
    throw new TypeError("ticket.priority is invalid.");
  }
  return value as TicketPriority;
}

function decodeVisibility(value: unknown): TicketCommentVisibility {
  if (typeof value !== "string" || !VISIBILITIES.includes(value as TicketCommentVisibility)) {
    throw new TypeError("comment.visibility is invalid.");
  }
  return value as TicketCommentVisibility;
}
