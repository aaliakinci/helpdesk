import { useCallback, useEffect, useRef, useState } from "react";

import type { SystemStatus } from "../api/systemStatusContract";
import { getSystemStatus } from "../api/systemStatusApi";

export type SystemStatusState =
  | { readonly kind: "error" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly report: SystemStatus };

export function useSystemStatus() {
  const [state, setState] = useState<SystemStatusState>({ kind: "loading" });
  const activeRequest = useRef<AbortController>();

  const reload = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setState({ kind: "loading" });

    try {
      const report = await getSystemStatus(controller.signal);
      if (!controller.signal.aborted) {
        setState({ kind: "ready", report });
      }
    } catch {
      if (!controller.signal.aborted) {
        setState({ kind: "error" });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    void getSystemStatus(controller.signal)
      .then((report) => {
        if (!controller.signal.aborted) setState({ kind: "ready", report });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "error" });
      });

    return () => controller.abort();
  }, []);

  return { reload, state };
}
