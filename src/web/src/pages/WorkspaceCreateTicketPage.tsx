import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function WorkspaceCreateTicketPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/workspace/tickets/new" id={id}>
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="staff" view="create" />
    </SessionFeature>
  );
}
