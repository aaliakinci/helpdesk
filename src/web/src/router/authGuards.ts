import { RouteGuard, type GuardContext, type GuardResult } from "@lily_platform/lily_ui/router";

import { workspaceLandingPath } from "@/features/auth/session";

import type { AppRouterState } from "./routes";

export class AuthenticatedGuard extends RouteGuard<AppRouterState> {
  readonly id = "authenticated";
  canActivate(context: GuardContext<AppRouterState>): GuardResult {
    return context.state?.authentication === "authenticated"
      ? { allow: true }
      : { allow: false, redirectTo: "/login", replace: true, reason: "authentication-required" };
  }
}

export class AnonymousGuard extends RouteGuard<AppRouterState> {
  readonly id = "anonymous";
  canActivate(context: GuardContext<AppRouterState>): GuardResult {
    return context.state?.authentication === "authenticated" && context.state.role
      ? {
          allow: false,
          redirectTo: workspaceLandingPath(context.state.role),
          replace: true,
          reason: "already-authenticated",
        }
      : { allow: true };
  }
}

abstract class RoleGuard extends RouteGuard<AppRouterState> {
  abstract readonly roles: readonly string[];
  canActivate(context: GuardContext<AppRouterState>): GuardResult {
    return context.state?.role && this.roles.includes(context.state.role)
      ? { allow: true }
      : { allow: false, redirectTo: "/", replace: true, reason: "role-required" };
  }
}

export class StaffGuard extends RoleGuard {
  readonly id = "staff";
  readonly roles = ["OWNER", "MANAGER", "AGENT"];
}

export class RequesterGuard extends RoleGuard {
  readonly id = "requester";
  readonly roles = ["REQUESTER"];
}

export class AuditorGuard extends RoleGuard {
  readonly id = "auditor";
  readonly roles = ["AUDITOR"];
}
