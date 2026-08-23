import { writeStructuredLog } from "../observability/json-logger.js";

interface ClosableApplication {
  close(): Promise<void>;
}

const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export function registerShutdownHandlers(application: ClosableApplication, service: string): void {
  let shuttingDown = false;

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      writeStructuredLog(service, "info", "service.stopping", { signal });

      const forcedExit = setTimeout(() => {
        writeStructuredLog(service, "error", "service.stop_timeout", { signal });
        process.exit(1);
      }, 12_000);
      forcedExit.unref();

      void application
        .close()
        .then(() => {
          clearTimeout(forcedExit);
          writeStructuredLog(service, "info", "service.stopped", { signal });
          process.exit(0);
        })
        .catch(() => {
          clearTimeout(forcedExit);
          writeStructuredLog(service, "error", "service.stop_failed", { signal });
          process.exit(1);
        });
    });
  }
}
