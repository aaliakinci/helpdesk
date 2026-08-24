import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function WorkspacePage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/workspace" id={id}>
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="staff" view="list" />
    </SessionFeature>
  );
}
