import { SessionFeature } from "@/features/auth";
import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import { useAppTranslation } from "@/i18n";

export function AuditWorkspacePage({ id }: { readonly id: string }) {
  const { t } = useAppTranslation();
  return (
    <SessionFeature activePath="/audit" id={id}>
      <Box id={`${id}.heading`}>
        <Typography id={`${id}.title`} component="h1" variant="h3">
          {t("app:session.auditor.title")}
        </Typography>
        <Typography id={`${id}.description`} component="p" sx={{ color: "text.secondary", mt: 1 }}>
          {t("app:session.auditor.description")}
        </Typography>
      </Box>
    </SessionFeature>
  );
}
