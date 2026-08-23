import { AppRouter } from "@lily_platform/lily_ui/router";

import { APP_ROUTES, appGuardRegistry, type AppRouterState } from "@/router";

const routerState: AppRouterState = {};

export function App() {
  return (
    <AppRouter
      routes={APP_ROUTES}
      guardRegistry={appGuardRegistry}
      state={routerState}
      routerType="hash"
      fallbackPath="/"
    />
  );
}
