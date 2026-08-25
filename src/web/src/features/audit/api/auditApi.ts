import { appHttpClient } from "@/shared/api";

import { decodeAuditPage, type AuditActorType, type AuditPage } from "./auditContract";

export interface AuditListFilters {
  readonly action: string;
  readonly actorType: AuditActorType | null;
  readonly actorUserId: string;
  readonly aggregateType: string;
  readonly from: string;
  readonly page: number;
  readonly pageSize: number;
  readonly to: string;
}

export function listAuditEntries(
  filters: AuditListFilters,
  signal?: AbortSignal,
): Promise<AuditPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.action) query.set("action", filters.action);
  if (filters.actorType) query.set("actorType", filters.actorType);
  if (filters.actorUserId) query.set("actorUserId", filters.actorUserId);
  if (filters.aggregateType) query.set("aggregateType", filters.aggregateType);
  if (filters.from) query.set("from", new Date(`${filters.from}T00:00:00.000Z`).toISOString());
  if (filters.to) query.set("to", new Date(`${filters.to}T23:59:59.999Z`).toISOString());
  return appHttpClient.getData<AuditPage>(`/api/v1/audit?${query.toString()}`, {
    decode: decodeAuditPage,
    metadata: { operationName: "audit.entries.read" },
    ...(signal ? { signal } : {}),
  });
}
