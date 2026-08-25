import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_PROXY_TARGET = "http://127.0.0.1:8080";
const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; connect-src 'self' ws: wss:; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

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
    "/socket.io": { target: apiProxyTarget, ws: true },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: ["react", "react-dom"],
    },
    server: { headers: securityHeaders, host: "127.0.0.1", port: 5173, proxy, strictPort: true },
    preview: {
      headers: securityHeaders,
      host: "127.0.0.1",
      port: 4173,
      proxy,
      strictPort: true,
    },
  };
});
