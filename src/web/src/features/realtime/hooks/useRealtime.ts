import { useEffect, useSyncExternalStore } from "react";

import { realtimeClient } from "../model/realtimeClient";

export function useRealtime() {
  return useSyncExternalStore(
    realtimeClient.subscribe,
    realtimeClient.getSnapshot,
    realtimeClient.getSnapshot,
  );
}

export function useRealtimeLifecycle(accessToken: string | null, sessionKey: string | null): void {
  useEffect(() => {
    realtimeClient.setSession(accessToken, sessionKey);
    return () => realtimeClient.setSession(null, null);
  }, [accessToken, sessionKey]);
}
