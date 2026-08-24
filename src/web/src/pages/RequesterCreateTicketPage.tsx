import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function RequesterCreateTicketPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/portal/tickets/new" id={id}>
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="requester" view="create" />
    </SessionFeature>
  );
}
