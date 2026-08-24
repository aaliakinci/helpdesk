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
export type TicketAssignmentStatus = "ASSIGNED" | "UNASSIGNED";
export type SlaMilestoneStatus = "ACTIVE" | "APPROACHING" | "BREACHED" | "COMPLETED";

export interface TicketRequester {
  readonly contactId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly displayName: string;
  readonly email: string;
}

export interface TicketSummary {
  readonly assignedAtUtc?: string | null;
  readonly assignee?: AssignmentPerson | null;
  readonly assignmentStatus: TicketAssignmentStatus;
  readonly createdAtUtc: string;
  readonly firstResponseAtUtc: string | null;
  readonly id: string;
  readonly number: number;
  readonly priority: TicketPriority;
  readonly queue?: QueueReference | null;
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
  readonly assignmentHistory?: readonly TicketAssignment[];
  readonly closedAtUtc: string | null;
  readonly comments: readonly TicketComment[];
  readonly description: string;
  readonly reopenedFrom: { readonly id: string; readonly number: number } | null;
  readonly reopenedTickets: readonly { readonly id: string; readonly number: number }[];
  readonly resolvedAtUtc: string | null;
  readonly sla?: {
    readonly autoCloseAtUtc: string | null;
    readonly firstResponse: TicketSlaMilestone;
    readonly policyVersion: number;
    readonly prioritySnapshot: TicketPriority;
    readonly resolution: TicketSlaMilestone;
    readonly wallClock: true;
  } | null;
  readonly statusHistory?: readonly {
    readonly actor: {
      readonly displayName: string | null;
      readonly id: string | null;
      readonly type: "SYSTEM" | "USER";
    };
    readonly fromStatus: TicketStatus | null;
    readonly id: string;
    readonly occurredAtUtc: string;
    readonly toStatus: TicketStatus;
    readonly version: number;
  }[];
  readonly tags: readonly { readonly id: string; readonly name: string }[];
}

export interface TicketSlaMilestone {
  readonly approachingSentAtUtc: string | null;
  readonly breachedAtUtc: string | null;
  readonly completedAtUtc: string | null;
  readonly dueAtUtc: string;
  readonly status: SlaMilestoneStatus;
}

export interface QueueReference {
  readonly id: string;
  readonly name: string;
}

export interface AssignmentPerson {
  readonly displayName: string;
  readonly membershipId: string;
}

export type TicketAssignmentAction =
  "QUEUED" | "ASSIGNED" | "UNASSIGNED" | "TAKEN_OVER" | "ROUND_ROBIN_ASSIGNED";

export interface TicketAssignment {
  readonly action: TicketAssignmentAction;
  readonly actor: { readonly displayName: string; readonly id: string };
  readonly fromAssignee: AssignmentPerson | null;
  readonly fromQueue: QueueReference | null;
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly toAssignee: AssignmentPerson | null;
  readonly toQueue: QueueReference | null;
  readonly version: number;
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
const ASSIGNMENT_STATUSES: readonly TicketAssignmentStatus[] = ["ASSIGNED", "UNASSIGNED"];

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
    ...(Object.hasOwn(value, "assignmentHistory")
      ? {
          assignmentHistory: requireArray(value.assignmentHistory, "assignmentHistory").map(
            (item) => {
              const assignment = requireRecord(item, "assignment history");
              return {
                action: decodeAssignmentAction(assignment.action),
                actor: decodePerson(assignment.actor),
                fromAssignee: decodeNullableAssignee(assignment.fromAssignee),
                fromQueue: decodeNullableQueue(assignment.fromQueue),
                id: requireString(assignment.id, "assignment.id"),
                occurredAtUtc: requireString(assignment.occurredAtUtc, "assignment.occurredAtUtc"),
                toAssignee: decodeNullableAssignee(assignment.toAssignee),
                toQueue: decodeNullableQueue(assignment.toQueue),
                version: requireNumber(assignment.version, "assignment.version"),
              };
            },
          ),
        }
      : {}),
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
    ...(Object.hasOwn(value, "sla")
      ? { sla: value.sla === null ? null : decodeTicketSla(value.sla) }
      : {}),
    ...(Object.hasOwn(value, "statusHistory")
      ? {
          statusHistory: requireArray(value.statusHistory, "statusHistory").map((item) => {
            const history = requireRecord(item, "status history");
            return {
              actor: decodeStatusActor(history.actor),
              fromStatus: history.fromStatus === null ? null : decodeStatus(history.fromStatus),
              id: requireString(history.id, "history.id"),
              occurredAtUtc: requireString(history.occurredAtUtc, "history.occurredAtUtc"),
              toStatus: decodeStatus(history.toStatus),
              version: requireNumber(history.version, "history.version"),
            };
          }),
        }
      : {}),
    tags: requireArray(value.tags, "tags").map((item) => {
      const tag = requireRecord(item, "tag");
      return { id: requireString(tag.id, "tag.id"), name: requireString(tag.name, "tag.name") };
    }),
  };
}

function decodeTicketSla(body: unknown): NonNullable<Required<Pick<TicketDetail, "sla">>["sla"]> {
  const value = requireRecord(body, "ticket SLA");
  if (value.wallClock !== true) throw new TypeError("ticket SLA wallClock is invalid.");
  return {
    autoCloseAtUtc: nullableString(value.autoCloseAtUtc, "sla.autoCloseAtUtc"),
    firstResponse: decodeSlaMilestone(value.firstResponse, "firstResponse"),
    policyVersion: requireNumber(value.policyVersion, "sla.policyVersion"),
    prioritySnapshot: decodePriority(value.prioritySnapshot),
    resolution: decodeSlaMilestone(value.resolution, "resolution"),
    wallClock: true,
  };
}

function decodeSlaMilestone(body: unknown, name: string): TicketSlaMilestone {
  const value = requireRecord(body, `SLA ${name}`);
  return {
    approachingSentAtUtc: nullableString(
      value.approachingSentAtUtc,
      `sla.${name}.approachingSentAtUtc`,
    ),
    breachedAtUtc: nullableString(value.breachedAtUtc, `sla.${name}.breachedAtUtc`),
    completedAtUtc: nullableString(value.completedAtUtc, `sla.${name}.completedAtUtc`),
    dueAtUtc: requireString(value.dueAtUtc, `sla.${name}.dueAtUtc`),
    status: decodeSlaMilestoneStatus(value.status),
  };
}

function decodeSlaMilestoneStatus(value: unknown): SlaMilestoneStatus {
  const statuses: readonly SlaMilestoneStatus[] = [
    "ACTIVE",
    "APPROACHING",
    "BREACHED",
    "COMPLETED",
  ];
  if (typeof value !== "string" || !statuses.includes(value as SlaMilestoneStatus)) {
    throw new TypeError("SLA milestone status is invalid.");
  }
  return value as SlaMilestoneStatus;
}

function decodeStatusActor(body: unknown): {
  readonly displayName: string | null;
  readonly id: string | null;
  readonly type: "SYSTEM" | "USER";
} {
  const value = requireRecord(body, "status actor");
  if (value.type !== "SYSTEM" && value.type !== "USER") {
    throw new TypeError("status actor type is invalid.");
  }
  return {
    displayName: nullableString(value.displayName, "status actor displayName"),
    id: nullableString(value.id, "status actor id"),
    type: value.type,
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
  const operationKeys = ["assignedAtUtc", "assignee", "queue"] as const;
  const operationKeyCount = operationKeys.filter((key) => Object.hasOwn(value, key)).length;
  if (operationKeyCount !== 0 && operationKeyCount !== operationKeys.length) {
    throw new TypeError("ticket operational projection is incomplete.");
  }
  return {
    ...(operationKeyCount === operationKeys.length
      ? {
          assignedAtUtc: nullableString(value.assignedAtUtc, "ticket.assignedAtUtc"),
          assignee: decodeNullableAssignee(value.assignee),
          queue: decodeNullableQueue(value.queue),
        }
      : {}),
    assignmentStatus: decodeAssignmentStatus(value.assignmentStatus),
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

function decodeAssignmentStatus(value: unknown): TicketAssignmentStatus {
  if (typeof value !== "string" || !ASSIGNMENT_STATUSES.includes(value as TicketAssignmentStatus)) {
    throw new TypeError("ticket.assignmentStatus is invalid.");
  }
  return value as TicketAssignmentStatus;
}

function decodeNullableQueue(value: unknown): QueueReference | null {
  if (value === null) return null;
  const queue = requireRecord(value, "queue reference");
  return {
    id: requireString(queue.id, "queue.id"),
    name: requireString(queue.name, "queue.name"),
  };
}

function decodeNullableAssignee(value: unknown): AssignmentPerson | null {
  if (value === null) return null;
  const assignee = requireRecord(value, "assignee");
  return {
    displayName: requireString(assignee.displayName, "assignee.displayName"),
    membershipId: requireString(assignee.membershipId, "assignee.membershipId"),
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

function decodeAssignmentAction(value: unknown): TicketAssignmentAction {
  const actions: readonly TicketAssignmentAction[] = [
    "QUEUED",
    "ASSIGNED",
    "UNASSIGNED",
    "TAKEN_OVER",
    "ROUND_ROBIN_ASSIGNED",
  ];
  if (typeof value !== "string" || !actions.includes(value as TicketAssignmentAction)) {
    throw new TypeError("assignment.action is invalid.");
  }
  return value as TicketAssignmentAction;
}
