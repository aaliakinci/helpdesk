import type { TenantRole } from "../../identity/domain/permissions.js";

export function realtimeQueueRoom(tenantId: string, queueId: string): string {
  return `tenant:${tenantId}:queue:${queueId}`;
}

export function realtimeRoleRoom(tenantId: string, role: TenantRole): string {
  return `tenant:${tenantId}:role:${role}`;
}

export function realtimeUserRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}
