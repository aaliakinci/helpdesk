import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";

export function RequesterPortalPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature id={id} mode="requester">
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="requester" />
    </SessionFeature>
  );
}
