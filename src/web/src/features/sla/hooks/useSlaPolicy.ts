import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/features/auth";
import { useAppTranslation } from "@/i18n";

import { getSlaPolicy, saveSlaPolicy } from "../api/slaApi";
import type { SlaPolicy, SlaPriority, SlaPolicyTarget } from "../api/slaContract";

interface SlaPolicyDraft {
  readonly autoCloseResolvedMinutes: string;
  readonly targets: Readonly<Record<SlaPriority, SlaTargetDraft>>;
}

interface SlaTargetDraft {
  readonly approachingBeforeMinutes: string;
  readonly firstResponseMinutes: string;
  readonly resolutionMinutes: string;
}

const PRIORITIES: readonly SlaPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const DEFAULT_TARGETS: Readonly<Record<SlaPriority, SlaTargetDraft>> = {
  LOW: { approachingBeforeMinutes: "60", firstResponseMinutes: "480", resolutionMinutes: "2880" },
  NORMAL: {
    approachingBeforeMinutes: "60",
    firstResponseMinutes: "240",
    resolutionMinutes: "1440",
  },
  HIGH: { approachingBeforeMinutes: "15", firstResponseMinutes: "60", resolutionMinutes: "480" },
  URGENT: { approachingBeforeMinutes: "5", firstResponseMinutes: "15", resolutionMinutes: "240" },
};

export function useSlaPolicy() {
  const auth = useAuth();
  const { t } = useAppTranslation();
  const role = auth.session?.activeTenant.role;
  const canManage = role === "OWNER" || role === "MANAGER";
  const [policy, setPolicy] = useState<SlaPolicy | null>(null);
  const [draft, setDraft] = useState<SlaPolicyDraft>({
    autoCloseResolvedMinutes: "4320",
    targets: DEFAULT_TARGETS,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load();
    return () => controller.abort();

    async function load(): Promise<void> {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const next = await getSlaPolicy(controller.signal);
        if (controller.signal.aborted) return;
        setPolicy(next);
        setDraft(toDraft(next));
      } catch {
        if (!controller.signal.aborted) setError(t("app:sla.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, [revision, t]);

  const setTarget = useCallback(
    (priority: SlaPriority, field: keyof SlaTargetDraft, value: string) => {
      setSuccess(false);
      setDraft((current) => ({
        ...current,
        targets: {
          ...current.targets,
          [priority]: { ...current.targets[priority], [field]: value },
        },
      }));
    },
    [],
  );

  const save = useCallback(async () => {
    const request = toRequest(draft, policy?.version ?? null);
    if (!request) {
      setError(t("app:sla.validation"));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const saved = await saveSlaPolicy(request);
      setPolicy(saved);
      setDraft(toDraft(saved));
      setSuccess(true);
    } catch {
      setError(t("app:sla.saveError"));
    } finally {
      setBusy(false);
    }
  }, [draft, policy?.version, t]);

  return {
    busy,
    canManage,
    draft,
    error,
    loading,
    policy,
    priorities: PRIORITIES,
    reload: () => setRevision((value) => value + 1),
    save,
    setAutoCloseResolvedMinutes: (value: string) => {
      setSuccess(false);
      setDraft((current) => ({ ...current, autoCloseResolvedMinutes: value }));
    },
    setTarget,
    success,
  };
}

function toDraft(policy: SlaPolicy | null): SlaPolicyDraft {
  if (!policy) return { autoCloseResolvedMinutes: "4320", targets: DEFAULT_TARGETS };
  const targets = Object.fromEntries(
    policy.targets.map((target) => [
      target.priority,
      {
        approachingBeforeMinutes: String(target.approachingBeforeMinutes),
        firstResponseMinutes: String(target.firstResponseMinutes),
        resolutionMinutes: String(target.resolutionMinutes),
      },
    ]),
  ) as Record<SlaPriority, SlaTargetDraft>;
  return { autoCloseResolvedMinutes: String(policy.autoCloseResolvedMinutes), targets };
}

function toRequest(
  draft: SlaPolicyDraft,
  expectedVersion: number | null,
): {
  readonly autoCloseResolvedMinutes: number;
  readonly expectedVersion: number | null;
  readonly targets: readonly SlaPolicyTarget[];
} | null {
  const autoCloseResolvedMinutes = parseInteger(draft.autoCloseResolvedMinutes);
  if (
    autoCloseResolvedMinutes === null ||
    autoCloseResolvedMinutes < 60 ||
    autoCloseResolvedMinutes > 43_200
  ) {
    return null;
  }
  const targets: SlaPolicyTarget[] = [];
  for (const priority of PRIORITIES) {
    const target = draft.targets[priority];
    const approachingBeforeMinutes = parseInteger(target.approachingBeforeMinutes);
    const firstResponseMinutes = parseInteger(target.firstResponseMinutes);
    const resolutionMinutes = parseInteger(target.resolutionMinutes);
    if (
      approachingBeforeMinutes === null ||
      firstResponseMinutes === null ||
      resolutionMinutes === null ||
      firstResponseMinutes < 2 ||
      resolutionMinutes < 2 ||
      firstResponseMinutes > 43_200 ||
      resolutionMinutes > 43_200 ||
      approachingBeforeMinutes < 1 ||
      approachingBeforeMinutes >= firstResponseMinutes ||
      approachingBeforeMinutes >= resolutionMinutes
    ) {
      return null;
    }
    targets.push({ approachingBeforeMinutes, firstResponseMinutes, priority, resolutionMinutes });
  }
  return { autoCloseResolvedMinutes, expectedVersion, targets };
}

function parseInteger(value: string): number | null {
  if (!/^[0-9]+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export type SlaPolicyController = ReturnType<typeof useSlaPolicy>;
