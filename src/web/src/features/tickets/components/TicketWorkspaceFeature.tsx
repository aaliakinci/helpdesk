import type { TicketMode } from "../model/ticketPresentation";
import { TicketCreatePanel } from "./TicketCreatePanel";
import { TicketDetailPanel } from "./TicketDetailPanel";
import { TicketListPanel } from "./TicketListPanel";

interface TicketWorkspaceFeatureProps {
  readonly id: string;
  readonly mode: TicketMode;
  readonly ticketId?: string | undefined;
  readonly view?: "create" | "list";
}

export function TicketWorkspaceFeature({
  id,
  mode,
  ticketId,
  view = "list",
}: TicketWorkspaceFeatureProps) {
  if (ticketId) {
    return <TicketDetailPanel id={`${id}.detail`} mode={mode} ticketId={ticketId} />;
  }

  if (view === "create") {
    return <TicketCreatePanel id={`${id}.create`} mode={mode} />;
  }

  return <TicketListPanel id={`${id}.list`} mode={mode} />;
}
