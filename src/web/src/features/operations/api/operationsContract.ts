import {
  requireArray,
  requireNumber,
  requireRecord,
  requireString,
} from "@/shared/api/contractDecoder";

export type QueueStatus = "ACTIVE" | "DISABLED";
export type QueueMemberStatus = "ACTIVE" | "DISABLED";

export interface QueueMember {
  readonly displayName: string;
  readonly email: string;
  readonly membershipId: string;
  readonly role: string;
  readonly status: QueueMemberStatus;
}

export interface QueueView {
  readonly activeMemberCount: number;
  readonly createdAtUtc: string;
  readonly description: string | null;
  readonly id: string;
  readonly members: readonly QueueMember[];
  readonly name: string;
  readonly openTicketCount: number;
  readonly status: QueueStatus;
  readonly unassignedTicketCount: number;
  readonly updatedAtUtc: string;
  readonly version: number;
}

export interface EligibleQueueMember {
  readonly displayName: string;
  readonly email: string;
  readonly membershipId: string;
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
    readonly warnings: readonly SlaWarning[];
  };
  readonly unassignedTickets: number;
}

export interface SlaWarning {
  readonly assignee: { readonly displayName: string; readonly membershipId: string } | null;
  readonly firstResponseStatus: SlaMilestoneStatus;
  readonly id: string;
  readonly nextDueAtUtc: string;
  readonly number: number;
  readonly priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  readonly queue: { readonly id: string; readonly name: string } | null;
  readonly resolutionStatus: SlaMilestoneStatus;
  readonly subject: string;
}

export type SlaMilestoneStatus = "ACTIVE" | "APPROACHING" | "BREACHED" | "COMPLETED";

export interface AgentWorkload {
  readonly assignedOpenTickets: number;
  readonly displayName: string;
  readonly membershipId: string;
  readonly queueIds: readonly string[];
}

export function decodeQueues(body: unknown): readonly QueueView[] {
  return requireArray(body, "queues").map(decodeQueue);
}

export function decodeQueue(body: unknown): QueueView {
  const value = requireRecord(body, "queue");
  return {
    activeMemberCount: requireNumber(value.activeMemberCount, "queue.activeMemberCount"),
    createdAtUtc: requireString(value.createdAtUtc, "queue.createdAtUtc"),
    description:
      value.description === null ? null : requireString(value.description, "queue.description"),
    id: requireString(value.id, "queue.id"),
    members: requireArray(value.members, "queue.members").map((item) => {
      const member = requireRecord(item, "queue member");
      return {
        displayName: requireString(member.displayName, "member.displayName"),
        email: requireString(member.email, "member.email"),
        membershipId: requireString(member.membershipId, "member.membershipId"),
        role: requireString(member.role, "member.role"),
        status: decodeMemberStatus(member.status),
      };
    }),
    name: requireString(value.name, "queue.name"),
    openTicketCount: requireNumber(value.openTicketCount, "queue.openTicketCount"),
    status: decodeQueueStatus(value.status),
    unassignedTicketCount: requireNumber(
      value.unassignedTicketCount,
      "queue.unassignedTicketCount",
    ),
    updatedAtUtc: requireString(value.updatedAtUtc, "queue.updatedAtUtc"),
    version: requireNumber(value.version, "queue.version"),
  };
}

export function decodeEligibleQueueMembers(body: unknown): readonly EligibleQueueMember[] {
  return requireArray(body, "eligible queue members").map((item) => {
    const member = requireRecord(item, "eligible queue member");
    return {
      displayName: requireString(member.displayName, "member.displayName"),
      email: requireString(member.email, "member.email"),
      membershipId: requireString(member.membershipId, "member.membershipId"),
    };
  });
}

export function decodeDashboard(body: unknown): OperationsDashboard {
  const value = requireRecord(body, "operations dashboard");
  const sla = requireRecord(value.sla, "dashboard.sla");
  if (sla.status !== "NOT_CONFIGURED" && sla.status !== "ACTIVE") {
    throw new TypeError("dashboard.sla status is invalid.");
  }
  const active = sla.status === "ACTIVE";
  return {
    myOpenTickets: requireNumber(value.myOpenTickets, "dashboard.myOpenTickets"),
    openTickets: requireNumber(value.openTickets, "dashboard.openTickets"),
    queues: requireArray(value.queues, "dashboard.queues").map((item) => {
      const queue = requireRecord(item, "dashboard queue");
      return {
        id: requireString(queue.id, "queue.id"),
        name: requireString(queue.name, "queue.name"),
        openTickets: requireNumber(queue.openTickets, "queue.openTickets"),
        unassignedTickets: requireNumber(queue.unassignedTickets, "queue.unassignedTickets"),
      };
    }),
    sla: {
      approachingTickets: active
        ? requireNumber(sla.approachingTickets, "dashboard.sla.approachingTickets")
        : requireNull(sla.approachingTickets, "dashboard.sla.approachingTickets"),
      breachedTickets: active
        ? requireNumber(sla.breachedTickets, "dashboard.sla.breachedTickets")
        : requireNull(sla.breachedTickets, "dashboard.sla.breachedTickets"),
      status: sla.status,
      warnings: requireArray(sla.warnings, "dashboard.sla.warnings").map(decodeSlaWarning),
    },
    unassignedTickets: requireNumber(value.unassignedTickets, "dashboard.unassignedTickets"),
  };
}

function decodeSlaWarning(body: unknown): SlaWarning {
  const value = requireRecord(body, "SLA warning");
  return {
    assignee: decodeNullableAssignment(value.assignee),
    firstResponseStatus: decodeSlaMilestoneStatus(value.firstResponseStatus),
    id: requireString(value.id, "warning.id"),
    nextDueAtUtc: requireString(value.nextDueAtUtc, "warning.nextDueAtUtc"),
    number: requireNumber(value.number, "warning.number"),
    priority: decodePriority(value.priority),
    queue: decodeNullableQueue(value.queue),
    resolutionStatus: decodeSlaMilestoneStatus(value.resolutionStatus),
    subject: requireString(value.subject, "warning.subject"),
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
    throw new TypeError("warning milestone status is invalid.");
  }
  return value as SlaMilestoneStatus;
}

function decodePriority(value: unknown): SlaWarning["priority"] {
  const priorities: readonly SlaWarning["priority"][] = ["LOW", "NORMAL", "HIGH", "URGENT"];
  if (typeof value !== "string" || !priorities.includes(value as SlaWarning["priority"])) {
    throw new TypeError("warning priority is invalid.");
  }
  return value as SlaWarning["priority"];
}

function decodeNullableAssignment(value: unknown): SlaWarning["assignee"] {
  if (value === null) return null;
  const assignment = requireRecord(value, "warning assignee");
  return {
    displayName: requireString(assignment.displayName, "warning.assignee.displayName"),
    membershipId: requireString(assignment.membershipId, "warning.assignee.membershipId"),
  };
}

function decodeNullableQueue(value: unknown): SlaWarning["queue"] {
  if (value === null) return null;
  const queue = requireRecord(value, "warning queue");
  return {
    id: requireString(queue.id, "warning.queue.id"),
    name: requireString(queue.name, "warning.queue.name"),
  };
}

function requireNull(value: unknown, name: string): null {
  if (value !== null) throw new TypeError(`${name} must be null.`);
  return null;
}

export function decodeAgentWorkload(body: unknown): readonly AgentWorkload[] {
  return requireArray(body, "agent workload").map((item) => {
    const workload = requireRecord(item, "agent workload item");
    return {
      assignedOpenTickets: requireNumber(
        workload.assignedOpenTickets,
        "workload.assignedOpenTickets",
      ),
      displayName: requireString(workload.displayName, "workload.displayName"),
      membershipId: requireString(workload.membershipId, "workload.membershipId"),
      queueIds: requireArray(workload.queueIds, "workload.queueIds").map((queueId) =>
        requireString(queueId, "workload.queueId"),
      ),
    };
  });
}

function decodeQueueStatus(value: unknown): QueueStatus {
  if (value !== "ACTIVE" && value !== "DISABLED") throw new TypeError("queue.status is invalid.");
  return value;
}

function decodeMemberStatus(value: unknown): QueueMemberStatus {
  if (value !== "ACTIVE" && value !== "DISABLED") {
    throw new TypeError("queue member status is invalid.");
  }
  return value;
}
