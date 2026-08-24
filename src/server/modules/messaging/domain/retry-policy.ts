export const RETRY_DELAYS_MS = [1_000, 5_000, 30_000] as const;

export function retryDelayMilliseconds(attempt: number): number {
  const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, attempt - 1));
  return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[0];
}

export function readDeliveryAttempt(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function resolveDeliveryFailure(
  attempt: number,
  maximumAttempts: number,
):
  | { readonly delayMilliseconds: number; readonly nextAttempt: number; readonly terminal: false }
  | { readonly nextAttempt: number; readonly terminal: true } {
  const nextAttempt = Math.max(0, attempt) + 1;
  return nextAttempt >= maximumAttempts
    ? { nextAttempt, terminal: true }
    : {
        delayMilliseconds: retryDelayMilliseconds(nextAttempt),
        nextAttempt,
        terminal: false,
      };
}
