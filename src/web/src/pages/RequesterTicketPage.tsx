import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";
import { useLilyParams } from "@lily_platform/lily_ui/router";

export function RequesterTicketPage({ id }: { readonly id: string }) {
  const { ticketId } = useLilyParams<{ ticketId: string }>();
  return (
    <SessionFeature activePath="/portal" id={id}>
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="requester" ticketId={ticketId} />
    </SessionFeature>
  );
}
