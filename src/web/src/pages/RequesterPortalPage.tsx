import { SessionFeature } from "@/features/auth";

export function RequesterPortalPage({ id }: { readonly id: string }) {
  return <SessionFeature id={id} mode="requester" />;
}
