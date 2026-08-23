import type { LilyPageComponent } from "@lily_platform/lily_ui";
import { createLilyRouterKit } from "@lily_platform/lily_ui/router";
import { createElement } from "react";

import { SystemStatusPage } from "@/pages/SystemStatusPage";

export type AppRouterState = Readonly<Record<string, never>>;

const routerKit = createLilyRouterKit<AppRouterState>();
const systemStatusPage: LilyPageComponent = (props) => createElement(SystemStatusPage, props);

export const appGuardRegistry = routerKit.createGuardRegistry();
export const APP_ROUTES = routerKit.createRoutes([
  { id: "system-status", path: "/", page: systemStatusPage },
]);
