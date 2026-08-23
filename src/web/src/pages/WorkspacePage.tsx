import { SessionFeature } from "@/features/auth";

export function WorkspacePage({ id }: { readonly id: string }) {
  return <SessionFeature id={id} mode="staff" />;
}
