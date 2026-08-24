import type { TenantRole } from "../api/authContract";

export type WorkspacePath =
  | "/account"
  | "/audit"
  | "/portal"
  | "/portal/tickets/new"
  | "/workspace"
  | "/workspace/operations"
  | "/workspace/queues"
  | "/workspace/tickets/new";

export interface WorkspaceNavigationItem {
  readonly labelKey: string;
  readonly path: WorkspacePath;
}

export function workspaceNavigationFor(
  role: TenantRole,
  permissions: readonly string[],
): readonly WorkspaceNavigationItem[] {
  const allowed = new Set(permissions);

  if (role === "REQUESTER") {
    return [
      allowed.has("tickets.read-own")
        ? { labelKey: "app:navigation.tickets", path: "/portal" as const }
        : null,
      allowed.has("tickets.create")
        ? { labelKey: "app:navigation.createTicket", path: "/portal/tickets/new" as const }
        : null,
      { labelKey: "app:navigation.account", path: "/account" as const },
    ].filter((item) => item !== null);
  }

  if (role === "AUDITOR") {
    return [
      { labelKey: "app:navigation.audit", path: "/audit" as const },
      { labelKey: "app:navigation.account", path: "/account" as const },
    ];
  }

  return [
    allowed.has("sla.read")
      ? { labelKey: "app:navigation.operations", path: "/workspace/operations" as const }
      : null,
    allowed.has("tickets.read")
      ? { labelKey: "app:navigation.tickets", path: "/workspace" as const }
      : null,
    allowed.has("tickets.create")
      ? { labelKey: "app:navigation.createTicket", path: "/workspace/tickets/new" as const }
      : null,
    allowed.has("queues.read")
      ? { labelKey: "app:navigation.queues", path: "/workspace/queues" as const }
      : null,
    allowed.has("audit.read")
      ? { labelKey: "app:navigation.audit", path: "/audit" as const }
      : null,
    { labelKey: "app:navigation.account", path: "/account" as const },
  ].filter((item) => item !== null);
}
