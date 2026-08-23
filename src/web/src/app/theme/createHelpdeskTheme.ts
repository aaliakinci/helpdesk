import { createTheme } from "@lily_platform/lily_ui/ui/themes";

export function createHelpdeskTheme(direction: "ltr" | "rtl") {
  return createTheme({
    direction,
    palette: {
      mode: "light",
      background: { default: "#f4f7fb", paper: "#ffffff" },
      primary: { main: "#14213d" },
      secondary: { main: "#007c83" },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      button: { fontWeight: 700, textTransform: "none" },
      h1: { fontWeight: 750 },
    },
  });
}
