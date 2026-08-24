import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function RequesterPortalPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/portal" id={id}>
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="requester" view="list" />
    </SessionFeature>
  );
}
