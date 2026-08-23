import { Box } from "@lily_platform/lily_ui/ui/atoms/Box";
import { Typography } from "@lily_platform/lily_ui/ui/atoms/Typography";

import type { CheckStatus } from "../api/systemStatusContract";

interface StatusCardProps {
  readonly durationMilliseconds?: number | undefined;
  readonly id: string;
  readonly label: string;
  readonly status?: CheckStatus | undefined;
  readonly statusLabel: string;
}

export function StatusCard({
  durationMilliseconds,
  id,
  label,
  status,
  statusLabel,
}: StatusCardProps) {
  return (
    <Box
      id={id}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",
        boxShadow: "0 18px 50px rgba(20, 33, 61, 0.07)",
        p: 3,
      }}
    >
      <Typography id={`${id}.label`} component="h2" variant="h6">
        {label}
      </Typography>
      <Typography
        id={`${id}.status`}
        component="p"
        sx={{
          color:
            status === undefined
              ? "text.secondary"
              : status === "up"
                ? "success.main"
                : "error.main",
          fontWeight: 700,
          mt: 1,
        }}
      >
        {statusLabel}
      </Typography>
      {durationMilliseconds !== undefined && (
        <Typography
          id={`${id}.duration`}
          component="p"
          variant="body2"
          sx={{ mt: 1, color: "text.secondary" }}
        >
          {durationMilliseconds.toFixed(2)} ms
        </Typography>
      )}
    </Box>
  );
}
