import { SessionFeature } from "@/features/auth";
import { TicketWorkspaceFeature } from "@/features/tickets";
import { useLilyParams } from "@lily_platform/lily_ui/router";

export function WorkspaceTicketPage({ id }: { readonly id: string }) {
  const { ticketId } = useLilyParams<{ ticketId: string }>();
  return (
    <SessionFeature id={id} mode="staff">
      <TicketWorkspaceFeature id={`${id}.tickets`} mode="staff" ticketId={ticketId} />
    </SessionFeature>
  );
}
