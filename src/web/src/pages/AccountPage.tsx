import { AccountFeature, SessionFeature } from "@/features/auth";

export function AccountPage({ id }: { readonly id: string }) {
  return (
    <SessionFeature activePath="/account" id={id}>
      <AccountFeature id={`${id}.account`} />
    </SessionFeature>
  );
}
