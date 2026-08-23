import { SessionFeature } from "@/features/auth";

export function AuditWorkspacePage({ id }: { readonly id: string }) {
  return <SessionFeature id={id} mode="auditor" />;
}
