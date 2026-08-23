import { LilyI18nDirectionProvider } from "@lily_platform/lily_ui/i18n/integrations/themes";
import { LilyI18nProvider } from "@lily_platform/lily_ui/i18n/react";
import { LilyStoreProvider } from "@lily_platform/lily_ui/state";
import { CssBaseline } from "@lily_platform/lily_ui/ui/themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { appStore } from "./app/store/appStore";
import { createHelpdeskTheme } from "./app/theme";
import { appI18nOptions } from "./i18n";
import { AppErrorBoundary } from "./shared/components";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Helpdesk root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <LilyI18nProvider options={appI18nOptions}>
        <LilyStoreProvider store={appStore}>
          <LilyI18nDirectionProvider createTheme={createHelpdeskTheme}>
            <CssBaseline />
            <App />
          </LilyI18nDirectionProvider>
        </LilyStoreProvider>
      </LilyI18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
