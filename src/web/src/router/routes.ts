import type { LilyPageComponent } from "@lily_platform/lily_ui";
import { createLilyRouterKit } from "@lily_platform/lily_ui/router";
import { createElement, lazy, Suspense } from "react";

import type { TenantRole } from "@/features/auth/session";
import { SystemStatusPage } from "@/pages/SystemStatusPage";

import {
  AnonymousGuard,
  AuditReadGuard,
  AuditorGuard,
  AuthenticatedGuard,
  OwnTicketReadGuard,
  QueueReadGuard,
  RequesterGuard,
  StaffGuard,
  SlaReadGuard,
  TicketCreateGuard,
  TicketReadGuard,
} from "./authGuards";

export interface AppRouterState {
  readonly authentication: "anonymous" | "authenticated";
  readonly permissions: readonly string[];
  readonly role: TenantRole | null;
}

const routerKit = createLilyRouterKit<AppRouterState>();
const systemStatusPage: LilyPageComponent = (props) => createElement(SystemStatusPage, props);

function lazyPage(importer: () => Promise<{ default: LilyPageComponent }>): LilyPageComponent {
  const Page = lazy(importer);
  return (props) => createElement(Suspense, { fallback: null }, createElement(Page, props));
}

const loginPage = lazyPage(async () => ({
  default: (await import("@/pages/LoginPage")).LoginPage,
}));
const workspacePage = lazyPage(async () => ({
  default: (await import("@/pages/WorkspacePage")).WorkspacePage,
}));
const workspaceCreateTicketPage = lazyPage(async () => ({
  default: (await import("@/pages/WorkspaceCreateTicketPage")).WorkspaceCreateTicketPage,
}));
const workspaceQueuesPage = lazyPage(async () => ({
  default: (await import("@/pages/WorkspaceQueuesPage")).WorkspaceQueuesPage,
}));
const workspaceOperationsPage = lazyPage(async () => ({
  default: (await import("@/pages/WorkspaceOperationsPage")).WorkspaceOperationsPage,
}));
const requesterPortalPage = lazyPage(async () => ({
  default: (await import("@/pages/RequesterPortalPage")).RequesterPortalPage,
}));
const requesterCreateTicketPage = lazyPage(async () => ({
  default: (await import("@/pages/RequesterCreateTicketPage")).RequesterCreateTicketPage,
}));
const workspaceTicketPage = lazyPage(async () => ({
  default: (await import("@/pages/WorkspaceTicketPage")).WorkspaceTicketPage,
}));
const requesterTicketPage = lazyPage(async () => ({
  default: (await import("@/pages/RequesterTicketPage")).RequesterTicketPage,
}));
const auditWorkspacePage = lazyPage(async () => ({
  default: (await import("@/pages/AuditWorkspacePage")).AuditWorkspacePage,
}));
const accountPage = lazyPage(async () => ({
  default: (await import("@/pages/AccountPage")).AccountPage,
}));

export const appGuardRegistry = routerKit.createGuardRegistry();
appGuardRegistry.register(AuthenticatedGuard);
appGuardRegistry.register(AnonymousGuard);
appGuardRegistry.register(StaffGuard);
appGuardRegistry.register(RequesterGuard);
appGuardRegistry.register(AuditorGuard);
appGuardRegistry.register(TicketReadGuard);
appGuardRegistry.register(OwnTicketReadGuard);
appGuardRegistry.register(TicketCreateGuard);
appGuardRegistry.register(QueueReadGuard);
appGuardRegistry.register(SlaReadGuard);
appGuardRegistry.register(AuditReadGuard);

export const APP_ROUTES = routerKit.createRoutes([
  { id: "system-status", path: "/", page: systemStatusPage },
  { id: "login", path: "/login", page: loginPage, guards: [AnonymousGuard] },
  {
    id: "workspace",
    path: "/workspace",
    page: workspacePage,
    guards: [AuthenticatedGuard, StaffGuard, TicketReadGuard],
  },
  {
    id: "workspace-create-ticket",
    path: "/workspace/tickets/new",
    page: workspaceCreateTicketPage,
    guards: [AuthenticatedGuard, StaffGuard, TicketCreateGuard],
  },
  {
    id: "workspace-operations",
    path: "/workspace/operations",
    page: workspaceOperationsPage,
    guards: [AuthenticatedGuard, StaffGuard, SlaReadGuard],
  },
  {
    id: "workspace-queues",
    path: "/workspace/queues",
    page: workspaceQueuesPage,
    guards: [AuthenticatedGuard, StaffGuard, QueueReadGuard],
  },
  {
    id: "workspace-ticket",
    path: "/workspace/tickets/:ticketId",
    page: workspaceTicketPage,
    guards: [AuthenticatedGuard, StaffGuard, TicketReadGuard],
  },
  {
    id: "requester-portal",
    path: "/portal",
    page: requesterPortalPage,
    guards: [AuthenticatedGuard, RequesterGuard, OwnTicketReadGuard],
  },
  {
    id: "requester-create-ticket",
    path: "/portal/tickets/new",
    page: requesterCreateTicketPage,
    guards: [AuthenticatedGuard, RequesterGuard, TicketCreateGuard],
  },
  {
    id: "requester-ticket",
    path: "/portal/tickets/:ticketId",
    page: requesterTicketPage,
    guards: [AuthenticatedGuard, RequesterGuard, OwnTicketReadGuard],
  },
  {
    id: "audit-workspace",
    path: "/audit",
    page: auditWorkspacePage,
    guards: [AuthenticatedGuard, AuditReadGuard],
  },
  {
    id: "account",
    path: "/account",
    page: accountPage,
    guards: [AuthenticatedGuard],
  },
]);
