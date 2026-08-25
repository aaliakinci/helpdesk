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

export interface TicketCommentView {
  readonly author: { readonly displayName: string; readonly id: string };
  readonly body: string;
  readonly createdAtUtc: string;
  readonly id: string;
  readonly visibility: TicketCommentVisibility;
}

export interface TicketStatusHistoryView {
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
}

export interface TicketPriorityHistoryView {
  readonly actor: {
    readonly displayName: string | null;
    readonly id: string | null;
    readonly type: "SYSTEM" | "USER";
  };
  readonly fromPriority: TicketPriority;
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly toPriority: TicketPriority;
}

export interface TicketDetail extends TicketSummary {
  readonly assignmentHistory?: readonly TicketAssignmentView[];
  readonly attachments: readonly TicketAttachmentView[];
  readonly closedAtUtc: string | null;
  readonly comments: readonly TicketCommentView[];
  readonly description: string;
  readonly priorityHistory?: readonly TicketPriorityHistoryView[];
  readonly reopenedFrom: { readonly id: string; readonly number: number } | null;
  readonly reopenedTickets: readonly { readonly id: string; readonly number: number }[];
  readonly resolvedAtUtc: string | null;
  readonly sla?: TicketSlaView | null;
  readonly statusHistory?: readonly TicketStatusHistoryView[];
  readonly tags: readonly { readonly id: string; readonly name: string }[];
}

export interface TicketAttachmentView {
  readonly byteSize: number;
  readonly commentId: string | null;
  readonly contentType: string;
  readonly createdAtUtc: string;
  readonly createdBy: { readonly displayName: string; readonly id: string };
  readonly fileName: string;
  readonly id: string;
  readonly visibility: TicketCommentVisibility;
}

export type SlaMilestoneViewStatus = "ACTIVE" | "APPROACHING" | "BREACHED" | "COMPLETED";

export interface TicketSlaView {
  readonly autoCloseAtUtc: string | null;
  readonly firstResponse: TicketSlaMilestoneView;
  readonly policyVersion: number;
  readonly prioritySnapshot: TicketPriority;
  readonly resolution: TicketSlaMilestoneView;
  readonly wallClock: true;
}

export interface TicketSlaMilestoneView {
  readonly approachingSentAtUtc: string | null;
  readonly breachedAtUtc: string | null;
  readonly completedAtUtc: string | null;
  readonly dueAtUtc: string;
  readonly status: SlaMilestoneViewStatus;
}

export type TicketAssignmentStatus = "ASSIGNED" | "UNASSIGNED";

export interface TicketPage {
  readonly items: readonly TicketSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface TicketListInput {
  readonly assignment: "ALL" | "MINE" | "UNASSIGNED";
  readonly page: number;
  readonly pageSize: number;
  readonly priority: TicketPriority | null;
  readonly queueId: string | null;
  readonly search: string | null;
  readonly sortBy: "createdAt" | "number" | "priority" | "updatedAt";
  readonly sortDirection: "asc" | "desc";
  readonly status: TicketStatus | null;
}

export interface QueueReference {
  readonly id: string;
  readonly name: string;
}

export interface AssignmentPerson {
  readonly displayName: string;
  readonly membershipId: string;
}

export interface TicketAssignmentView {
  readonly action: "QUEUED" | "ASSIGNED" | "UNASSIGNED" | "TAKEN_OVER" | "ROUND_ROBIN_ASSIGNED";
  readonly actor: { readonly displayName: string; readonly id: string };
  readonly fromAssignee: AssignmentPerson | null;
  readonly fromQueue: QueueReference | null;
  readonly id: string;
  readonly occurredAtUtc: string;
  readonly toAssignee: AssignmentPerson | null;
  readonly toQueue: QueueReference | null;
  readonly version: number;
}

export interface QueueMemberView extends AssignmentPerson {
  readonly email: string;
  readonly role: string;
  readonly status: "ACTIVE" | "DISABLED";
}

export interface QueueView extends QueueReference {
  readonly activeMemberCount: number;
  readonly createdAtUtc: string;
  readonly description: string | null;
  readonly members: readonly QueueMemberView[];
  readonly openTicketCount: number;
  readonly status: "ACTIVE" | "DISABLED";
  readonly unassignedTicketCount: number;
  readonly updatedAtUtc: string;
  readonly version: number;
}

export interface EligibleQueueMember extends AssignmentPerson {
  readonly email: string;
}

export interface OperationsDashboard {
  readonly myOpenTickets: number;
  readonly openTickets: number;
  readonly queues: readonly {
    readonly id: string;
    readonly name: string;
    readonly openTickets: number;
    readonly unassignedTickets: number;
  }[];
  readonly sla: {
    readonly approachingTickets: number | null;
    readonly breachedTickets: number | null;
    readonly status: "ACTIVE" | "NOT_CONFIGURED";
    readonly warnings: readonly SlaWarningItem[];
  };
  readonly unassignedTickets: number;
}

export interface SlaWarningItem {
  readonly assignee: AssignmentPerson | null;
  readonly firstResponseStatus: Exclude<SlaMilestoneViewStatus, "COMPLETED"> | "COMPLETED";
  readonly id: string;
  readonly nextDueAtUtc: string;
  readonly number: number;
  readonly priority: TicketPriority;
  readonly queue: QueueReference | null;
  readonly resolutionStatus: Exclude<SlaMilestoneViewStatus, "COMPLETED"> | "COMPLETED";
  readonly subject: string;
}

export interface AgentWorkloadItem extends AssignmentPerson {
  readonly assignedOpenTickets: number;
  readonly queueIds: readonly string[];
}
