import { createLilyFormController } from "@lily_platform/lily_ui/ui/forms";
import { useMemo, useState } from "react";

import { useAppTranslation } from "@/i18n";

import { replyFormDefinition, type ReplyFormValues } from "../model/ticketForms";

export function useTicketReply() {
  const { t } = useAppTranslation();
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC");
  const controller = useMemo(() => createLilyFormController<ReplyFormValues>(), []);
  const definition = useMemo(() => replyFormDefinition(t, visibility), [t, visibility]);

  return { controller, definition, setVisibility, visibility };
}
