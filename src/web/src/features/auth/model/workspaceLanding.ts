import type { TenantRole } from "../api/authContract";

export function workspaceLandingPath(role: TenantRole): string {
  if (role === "REQUESTER") return "/portal";
  if (role === "AUDITOR") return "/audit";
  return "/workspace";
}
