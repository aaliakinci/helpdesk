import { SystemStatusFeature } from "@/features/system-status";

interface SystemStatusPageProps {
  readonly id: string;
}

export function SystemStatusPage({ id }: SystemStatusPageProps) {
  return <SystemStatusFeature id={`${id}.feature`} />;
}
