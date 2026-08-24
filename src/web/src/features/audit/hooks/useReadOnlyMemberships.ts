import { useCallback, useEffect, useState } from "react";

import { listReadOnlyMemberships } from "../api/auditApi";
import type { TenantMembershipView } from "../api/auditContract";

export function useReadOnlyMemberships() {
  const [memberships, setMemberships] = useState<readonly TenantMembershipView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      setLoading(true);
      setFailed(false);
      try {
        const nextMemberships = await listReadOnlyMemberships(controller.signal);
        if (!controller.signal.aborted) setMemberships(nextMemberships);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  return { failed, loading, memberships, reload };
}
