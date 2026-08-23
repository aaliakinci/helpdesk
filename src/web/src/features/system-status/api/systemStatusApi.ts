import { appHttpClient } from "@/shared/api";

import { decodeSystemStatus, type SystemStatus } from "./systemStatusContract";

export function getSystemStatus(signal?: AbortSignal): Promise<SystemStatus> {
  return appHttpClient.getData<SystemStatus>("api/v1/system/status", {
    decode: decodeSystemStatus,
    metadata: { operationName: "system.status" },
    ...(signal ? { signal } : {}),
  });
}
