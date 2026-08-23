import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Button } from "@lily_platform/lily_ui/ui/atoms/Button";
import { Stack } from "@lily_platform/lily_ui/ui/atoms/Stack";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";
import type { PropsWithChildren } from "react";

interface PublicShellProps extends PropsWithChildren {
  readonly brand: string;
  readonly id: string;
  readonly languageLabel: string;
  readonly locale: string;
  readonly onLocaleChange: (locale: "en-US" | "tr-TR") => void;
  readonly skipToContentLabel: string;
}

export function PublicShell({
  brand,
  children,
  id,
  languageLabel,
  locale,
  onLocaleChange,
  skipToContentLabel,
}: PublicShellProps) {
  return (
    <Box id={id} sx={{ minHeight: "100vh" }}>
      <a className="skip-link" href="#main-content">
        {skipToContentLabel}
      </a>
      <Box
        id={`${id}.header`}
        component="header"
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}
      >
        <Stack
          id={`${id}.header.content`}
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            maxWidth: 1120,
            mx: "auto",
            px: 3,
            py: 2,
          }}
        >
          <Typography id={`${id}.brand`} component="span" variant="h6">
            {brand}
          </Typography>
          <Stack id={`${id}.locale`} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography id={`${id}.locale.label`} component="span" variant="body2">
              {languageLabel}
            </Typography>
            <Button
              id={`${id}.locale.tr`}
              size="small"
              variant={locale === "tr-TR" ? "contained" : "text"}
              onClick={() => onLocaleChange("tr-TR")}
            >
              TR
            </Button>
            <Button
              id={`${id}.locale.en`}
              size="small"
              variant={locale === "en-US" ? "contained" : "text"}
              onClick={() => onLocaleChange("en-US")}
            >
              EN
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Box
        id="main-content"
        component="main"
        tabIndex={-1}
        sx={{ maxWidth: 1120, mx: "auto", px: 3, py: { xs: 5, md: 9 } }}
      >
        {children}
      </Box>
    </Box>
  );
}
