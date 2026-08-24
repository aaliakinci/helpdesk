import { SessionFeature } from "@/features/auth";
import { AuditWorkspaceFeature } from "@/features/audit";

export function AuditWorkspacePage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/audit" id={id}>
      <AuditWorkspaceFeature id={`${id}.audit`} />
    </SessionFeature>
  );
}
