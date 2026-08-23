import { LoginFeature } from "@/features/auth";

export function LoginPage({ id }: { readonly id: string }) {
  return <LoginFeature id={id} />;
}
