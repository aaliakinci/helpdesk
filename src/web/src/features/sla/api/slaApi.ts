import { appHttpClient } from "@/shared/api";

import { decodeSlaPolicy, type SaveSlaPolicyRequest, type SlaPolicy } from "./slaContract";

export function getSlaPolicy(signal?: AbortSignal): Promise<SlaPolicy | null> {
  return appHttpClient.getData<SlaPolicy | null>("/api/v1/sla/policy", {
    decode: decodeSlaPolicy,
    metadata: { operationName: "sla.policy.get" },
    ...(signal ? { signal } : {}),
  });
}

export function saveSlaPolicy(request: SaveSlaPolicyRequest): Promise<SlaPolicy> {
  return appHttpClient.putData<SlaPolicy, SaveSlaPolicyRequest>("/api/v1/sla/policy", request, {
    decode: (body) => {
      const policy = decodeSlaPolicy(body);
      if (!policy) throw new TypeError("Saved SLA policy is missing.");
      return policy;
    },
    metadata: { operationName: "sla.policy.save", replay: "deny" },
  });
}
