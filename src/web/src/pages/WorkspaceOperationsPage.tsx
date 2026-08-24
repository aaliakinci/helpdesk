import { SessionFeature } from "@/features/auth";
import { OperationsDashboardFeature } from "@/features/operations";

export function WorkspaceOperationsPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/workspace/operations" id={id}>
      <OperationsDashboardFeature id={`${id}.dashboard`} />
    </SessionFeature>
  );
}
