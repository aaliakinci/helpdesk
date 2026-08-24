import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function WorkspacePage({ id }: { readonly id: string }) {
  return (
    <SessionFeature id={id} mode="staff">
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="staff" />
    </SessionFeature>
  );
}
