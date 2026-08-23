import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_PROXY_TARGET = "http://127.0.0.1:8080";

function resolveApiProxyTarget(value: string | undefined): string {
  const parsedUrl = new URL(value?.trim() || DEFAULT_API_PROXY_TARGET);
  if (
    (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("VITE_DEV_API_PROXY_TARGET must be a credential-free HTTP(S) URL.");
  }
  return parsedUrl.origin;
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = resolveApiProxyTarget(environment.VITE_DEV_API_PROXY_TARGET);
  const proxy = {
    "/api": apiProxyTarget,
    "/health": apiProxyTarget,
    "/openapi": apiProxyTarget,
  };

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: ["react", "react-dom"],
    },
    server: { host: "127.0.0.1", port: 5173, proxy, strictPort: true },
    preview: { host: "127.0.0.1", port: 4173, proxy, strictPort: true },
  };
});
