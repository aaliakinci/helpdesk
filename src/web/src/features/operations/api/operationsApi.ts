import { appHttpClient } from "@/shared/api";

import {
  decodeAgentWorkload,
  decodeDashboard,
  decodeEligibleQueueMembers,
  decodeQueue,
  decodeQueues,
  type AgentWorkload,
  type EligibleQueueMember,
  type OperationsDashboard,
  type QueueMemberStatus,
  type QueueStatus,
  type QueueView,
} from "./operationsContract";

const mutationMetadata = { operationName: "queues.mutation", replay: "deny" as const };

export function listQueues(signal?: AbortSignal): Promise<readonly QueueView[]> {
  return appHttpClient.getData<readonly QueueView[]>("/api/v1/queues", {
    decode: decodeQueues,
    metadata: { operationName: "queues.list" },
    ...(signal ? { signal } : {}),
  });
}

export function listEligibleMembers(signal?: AbortSignal): Promise<readonly EligibleQueueMember[]> {
  return appHttpClient.getData<readonly EligibleQueueMember[]>("/api/v1/queues/eligible-members", {
    decode: decodeEligibleQueueMembers,
    metadata: { operationName: "queues.eligible-members" },
    ...(signal ? { signal } : {}),
  });
}

export function createQueue(request: {
  readonly description: string | null;
  readonly name: string;
}): Promise<QueueView> {
  return appHttpClient.postData<QueueView, typeof request>("/api/v1/queues", request, {
    decode: decodeQueue,
    metadata: { ...mutationMetadata, operationName: "queues.create" },
  });
}

export function updateQueue(
  queueId: string,
  request: {
    readonly description: string | null;
    readonly expectedVersion: number;
    readonly name: string;
    readonly status: QueueStatus;
  },
): Promise<QueueView> {
  return appHttpClient.patchData<QueueView, typeof request>(`/api/v1/queues/${queueId}`, request, {
    decode: decodeQueue,
    metadata: { ...mutationMetadata, operationName: "queues.update" },
  });
}

export function setQueueMember(
  queueId: string,
  request: {
    readonly expectedVersion: number;
    readonly membershipId: string;
    readonly status: QueueMemberStatus;
  },
): Promise<QueueView> {
  return appHttpClient.postData<QueueView, typeof request>(
    `/api/v1/queues/${queueId}/members`,
    request,
    {
      decode: decodeQueue,
      metadata: { ...mutationMetadata, operationName: "queues.set-member" },
    },
  );
}

export function getDashboard(signal?: AbortSignal): Promise<OperationsDashboard> {
  return appHttpClient.getData<OperationsDashboard>("/api/v1/operations/dashboard", {
    decode: decodeDashboard,
    metadata: { operationName: "operations.dashboard" },
    ...(signal ? { signal } : {}),
  });
}

export function listAgentWorkload(signal?: AbortSignal): Promise<readonly AgentWorkload[]> {
  return appHttpClient.getData<readonly AgentWorkload[]>("/api/v1/operations/agent-workload", {
    decode: decodeAgentWorkload,
    metadata: { operationName: "operations.agent-workload" },
    ...(signal ? { signal } : {}),
  });
}
