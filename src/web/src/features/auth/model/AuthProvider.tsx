import { useEffect, useMemo, useSyncExternalStore, type PropsWithChildren } from "react";

import {
  listAvailableTenants,
  login,
  logout,
  refreshAuthentication,
  revokeAllSessions,
  switchTenant,
} from "../api/authApi";
import { AuthContext, type AuthContextValue } from "./authContext";
import { authSessionStore } from "./authSessionStore";

let initializationPromise: Promise<void> | null = null;

export function AuthProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(
    authSessionStore.subscribe,
    authSessionStore.getSnapshot,
    authSessionStore.getSnapshot,
  );

  useEffect(() => {
    initializationPromise ??= initializeSession();
    void initializationPromise;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...snapshot,
      listAvailableTenants,
      login,
      logout,
      revokeAllSessions,
      switchTenant,
    }),
    [snapshot],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function initializeSession(): Promise<void> {
  try {
    await refreshAuthentication();
  } catch {
    authSessionStore.clear();
  } finally {
    authSessionStore.markInitialized();
  }
}
