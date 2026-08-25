export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class BoundedRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public constructor(private readonly maximumKeys = 10_000) {}

  public consume(
    key: string,
    limit: number,
    windowMilliseconds: number,
    now = Date.now(),
  ): RateLimitDecision {
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMilliseconds };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    this.prune(now);
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  private prune(now: number): void {
    if (this.buckets.size <= this.maximumKeys) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now || this.buckets.size > this.maximumKeys) this.buckets.delete(key);
      if (this.buckets.size <= this.maximumKeys) break;
    }
  }
}
