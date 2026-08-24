import { requireArray, requireRecord, requireString } from "@/shared/api/contractDecoder";

export interface TenantMembershipView {
  readonly id: string;
  readonly role: "OWNER" | "MANAGER" | "AGENT" | "REQUESTER" | "AUDITOR";
  readonly status: "ACTIVE" | "DISABLED";
  readonly user: {
    readonly displayName: string;
    readonly email: string;
    readonly id: string;
  };
}

const ROLES: readonly TenantMembershipView["role"][] = [
  "OWNER",
  "MANAGER",
  "AGENT",
  "REQUESTER",
  "AUDITOR",
];

export function decodeMemberships(body: unknown): readonly TenantMembershipView[] {
  return requireArray(body, "memberships").map((item) => {
    const membership = requireRecord(item, "membership");
    const user = requireRecord(membership.user, "membership.user");
    const role = requireString(membership.role, "membership.role");
    const status = requireString(membership.status, "membership.status");
    if (!ROLES.includes(role as TenantMembershipView["role"])) {
      throw new TypeError("membership.role is invalid.");
    }
    if (status !== "ACTIVE" && status !== "DISABLED") {
      throw new TypeError("membership.status is invalid.");
    }
    return {
      id: requireString(membership.id, "membership.id"),
      role: role as TenantMembershipView["role"],
      status,
      user: {
        displayName: requireString(user.displayName, "membership.user.displayName"),
        email: requireString(user.email, "membership.user.email"),
        id: requireString(user.id, "membership.user.id"),
      },
    };
  });
}
