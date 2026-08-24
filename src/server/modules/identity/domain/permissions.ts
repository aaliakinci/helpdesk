export const TENANT_ROLES = ["OWNER", "MANAGER", "AGENT", "REQUESTER", "AUDITOR"] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const PERMISSIONS = [
  "tenant.read",
  "memberships.read",
  "memberships.manage-status",
  "memberships.manage-role",
  "customers.read",
  "customers.manage",
  "tickets.read",
  "tickets.read-own",
  "tickets.create",
  "tickets.manage",
  "queues.read",
  "queues.manage",
  "sla.read",
  "sla.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Readonly<Record<TenantRole, readonly Permission[]>> = {
  OWNER: PERMISSIONS,
  MANAGER: [
    "tenant.read",
    "memberships.read",
    "memberships.manage-status",
    "customers.read",
    "customers.manage",
    "tickets.read",
    "tickets.create",
    "tickets.manage",
    "queues.read",
    "queues.manage",
    "sla.read",
    "sla.manage",
    "audit.read",
  ],
  AGENT: [
    "tenant.read",
    "customers.read",
    "tickets.read",
    "tickets.create",
    "tickets.manage",
    "queues.read",
    "sla.read",
  ],
  REQUESTER: ["tenant.read", "tickets.read-own", "tickets.create"],
  AUDITOR: [
    "tenant.read",
    "memberships.read",
    "customers.read",
    "tickets.read",
    "queues.read",
    "sla.read",
    "audit.read",
  ],
};

export function permissionsForRole(role: TenantRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function isTenantRole(value: unknown): value is TenantRole {
  return typeof value === "string" && (TENANT_ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: TenantRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
