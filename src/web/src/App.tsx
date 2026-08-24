import { AppRouter } from "@lily_platform/lily_ui/router";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Progress } from "@lily_platform/lily_ui/ui/atoms/Progress";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAuth } from "@/features/auth/session";
import { useRealtimeLifecycle } from "@/features/realtime";
import { useAppTranslation } from "@/i18n";
import { APP_ROUTES, appGuardRegistry, type AppRouterState } from "@/router";

export function App() {
  const { initialized, session } = useAuth();
  useRealtimeLifecycle(
    session?.accessToken ?? null,
    session ? `${session.activeTenant.id}:${session.user.id}` : null,
  );
  const { t } = useAppTranslation();
  if (!initialized) {
    return (
      <Box id="auth.bootstrap" sx={{ display: "grid", minHeight: "100vh", placeItems: "center" }}>
        <Stack id="auth.bootstrap.content" spacing={2} sx={{ alignItems: "center" }}>
          <Progress id="auth.bootstrap.progress" aria-label={t("app:auth.initializing")} />
          <Typography id="auth.bootstrap.label" component="p" variant="body2">
            {t("app:auth.initializing")}
          </Typography>
        </Stack>
      </Box>
    );
  }

  const routerState: AppRouterState = {
    authentication: session ? "authenticated" : "anonymous",
    permissions: session?.activeTenant.permissions ?? [],
    role: session?.activeTenant.role ?? null,
  };

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
