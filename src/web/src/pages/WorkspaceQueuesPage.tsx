import { SessionFeature } from "@/features/auth";
import { QueueOperationsFeature } from "@/features/operations";

export function WorkspaceQueuesPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/workspace/queues" id={id}>
      <QueueOperationsFeature id={`${id}.operations`} />
    </SessionFeature>
  );
}
