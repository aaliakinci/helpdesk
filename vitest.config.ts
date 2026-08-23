import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/web/src", import.meta.url)) },
  },
  test: {
    coverage: { enabled: false },
    environment: "node",
    exclude: ["tests/integration/**", "node_modules/**", "dist/**"],
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.ts", "tests/contract/**/*.test.ts"],
  },
});
