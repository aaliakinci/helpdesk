import type { LilyEmbeddedMessages } from "@lily_platform/lily_ui/i18n";

import { appMessagesEnUs } from "./en-US/app";
import { appMessagesTrTr } from "./tr-TR/app";

export const appMessages = {
  "en-US": { app: appMessagesEnUs },
  "tr-TR": { app: appMessagesTrTr },
} as const satisfies LilyEmbeddedMessages;
