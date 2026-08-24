import { useLilyNavigate } from "@lily_platform/lily_ui/router";
import { useState } from "react";

import { useAuth } from "../model/authContext";
import { workspaceLandingPath } from "../model/workspaceLanding";

export function useAccountSession() {
  const auth = useAuth();
  const navigate = useLilyNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function perform(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    session: auth.session,
    switchTenant: (tenantId: string) =>
      perform(async () => {
        const response = await auth.switchTenant(tenantId);
        if (response.activeTenant) {
          await navigate(workspaceLandingPath(response.activeTenant.role));
        }
      }),
    logout: () =>
      perform(async () => {
        await auth.logout();
        await navigate("/login");
      }),
    revokeAllSessions: () =>
      perform(async () => {
        await auth.revokeAllSessions();
        await navigate("/login");
      }),
  };
}
