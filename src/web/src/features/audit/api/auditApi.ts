import { appHttpClient } from "@/shared/api";

import { decodeMemberships, type TenantMembershipView } from "./auditContract";

export function listReadOnlyMemberships(
  signal?: AbortSignal,
): Promise<readonly TenantMembershipView[]> {
  return appHttpClient.getData<readonly TenantMembershipView[]>("/api/v1/memberships", {
    decode: decodeMemberships,
    metadata: { operationName: "audit.memberships.read" },
    ...(signal ? { signal } : {}),
  });
}
