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
    readonly breachedTickets: null;
    readonly dueSoonTickets: null;
    readonly status: "NOT_CONFIGURED";
  };
  readonly unassignedTickets: number;
}

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
  if (
    sla.status !== "NOT_CONFIGURED" ||
    sla.breachedTickets !== null ||
    sla.dueSoonTickets !== null
  ) {
    throw new TypeError("dashboard.sla is invalid.");
  }
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
    sla: { breachedTickets: null, dueSoonTickets: null, status: "NOT_CONFIGURED" },
    unassignedTickets: requireNumber(value.unassignedTickets, "dashboard.unassignedTickets"),
  };
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
