import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { Alert } from "@lily_platform/lily_ui/ui/atoms/Alert";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import { useState, type ReactNode } from "react";

import { useAppTranslation } from "@/i18n";

import { useAuth } from "../model/authContext";
import { workspaceNavigationFor, type WorkspacePath } from "../model/workspaceNavigation";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface SessionFeatureProps {
  readonly activePath: WorkspacePath;
  readonly children?: ReactNode;
  readonly id: string;
}

export function SessionFeature({ activePath, children, id }: SessionFeatureProps) {
  const auth = useAuth();
  const navigate = useLilyNavigate();
  const { changeLocale, locale, t } = useAppTranslation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const online = useOnlineStatus();
  const session = auth.session;
  if (!session) return null;

  const navigation = workspaceNavigationFor(
    session.activeTenant.role,
    session.activeTenant.permissions,
  );
  const mainId = `${id}.main`;
  const requesterShell = session.activeTenant.role === "REQUESTER";
  const shellWidth = requesterShell ? 960 : 1280;

  return (
    <Box id={id} sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <a
        id={`${id}.skip-link`}
        className="skip-link"
        href={`#${mainId}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(mainId)?.focus();
        }}
      >
        {t("app:shell.skipToContent")}
      </a>
      <Box
        id={`${id}.header`}
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Stack
          id={`${id}.header.content`}
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", lg: "center" },
            maxWidth: shellWidth,
            mx: "auto",
            px: { xs: 2, sm: 3 },
            py: 1.5,
          }}
        >
          <Box id={`${id}.brand`} sx={{ minWidth: 210 }}>
            <Typography id={`${id}.brand.name`} component="span" variant="h6">
              {t(requesterShell ? "app:shell.portalBrand" : "app:brand")}
            </Typography>
            <Typography
              id={`${id}.brand.tenant`}
              component="span"
              variant="body2"
              sx={{ color: "text.secondary", ml: 1.5 }}
            >
              {session.activeTenant.name}
            </Typography>
          </Box>
          <Stack
            id={`${id}.navigation`}
            component="nav"
            aria-label={t("app:navigation.workspace")}
            direction="row"
            spacing={0.5}
            sx={{ flex: 1, flexWrap: "wrap" }}
          >
            {navigation.map((item) => (
              <Button
                key={item.path}
                id={`${id}.navigation.${pathId(item.path)}`}
                size="small"
                variant={activePath === item.path ? "contained" : "text"}
                onClick={() => void navigate(item.path)}
              >
                {t(item.labelKey)}
              </Button>
            ))}
          </Stack>
          <Button
            id={`${id}.notifications.toggle`}
            size="small"
            variant={notificationOpen ? "outlined" : "text"}
            aria-controls={`${id}.notifications.panel`}
            aria-expanded={notificationOpen}
            aria-haspopup="true"
            onClick={() => setNotificationOpen((value) => !value)}
          >
            {t("app:shell.notifications")} (0)
          </Button>
          <Stack id={`${id}.locale`} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Typography id={`${id}.locale.label`} component="span" variant="body2">
              {t("app:shell.language")}
            </Typography>
            <Button
              id={`${id}.locale.tr`}
              size="small"
              variant={locale === "tr-TR" ? "contained" : "text"}
              aria-pressed={locale === "tr-TR"}
              onClick={() => void changeLocale("tr-TR")}
            >
              TR
            </Button>
            <Button
              id={`${id}.locale.en`}
              size="small"
              variant={locale === "en-US" ? "contained" : "text"}
              aria-pressed={locale === "en-US"}
              onClick={() => void changeLocale("en-US")}
            >
              EN
            </Button>
          </Stack>
        </Stack>
        {notificationOpen && (
          <Box
            id={`${id}.notifications.panel`}
            role="region"
            aria-label={t("app:shell.notificationCenter")}
            sx={{ maxWidth: shellWidth, mx: "auto", px: { xs: 2, sm: 3 }, pb: 2 }}
          >
            <Alert id={`${id}.notifications.empty`} severity="info">
              {t("app:shell.noNotifications")}
            </Alert>
          </Box>
        )}
      </Box>
      {!online && (
        <Alert id={`${id}.offline`} severity="warning">
          {t("app:shell.offline")}
        </Alert>
      )}
      <Box
        id={mainId}
        component="main"
        tabIndex={-1}
        sx={{
          maxWidth: shellWidth,
          minWidth: 0,
          mx: "auto",
          overflowX: "clip",
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 5 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function pathId(path: WorkspacePath): string {
  return path.replace(/^\//u, "").replaceAll("/", ".");
}
