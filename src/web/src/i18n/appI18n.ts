import { LilyEmbeddedMessageLoader, type CreateLilyI18nOptions } from "@lily_platform/lily_ui/i18n";

import { appMessages } from "./messages";

export const appI18nOptions: CreateLilyI18nOptions = {
  defaultLocale: "tr-TR",
  fallbackLocale: "en-US",
  supportedLocales: ["tr-TR", "en-US"],
  localeAliases: { en: "en-US", tr: "tr-TR" },
  namespaces: ["app", "lily-common", "lily-errors"],
  defaultNamespace: "app",
  defaultTimeZone: "Europe/Istanbul",
  loader: new LilyEmbeddedMessageLoader(appMessages),
};
