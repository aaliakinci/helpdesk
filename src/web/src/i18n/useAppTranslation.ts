import { useLilyI18n } from "@lily_platform/lily_ui/i18n/react";
import { useCallback } from "react";

export function useAppTranslation() {
  const { changeLocale, locale, i18n } = useLilyI18n();
  const t = useCallback((key: string): string => i18n.t(key), [i18n]);
  return { changeLocale, locale, t };
}
