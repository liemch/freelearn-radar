/**
 * Spaces outbound requests per domain (§76). Concurrency alone does not bound
 * this: two workers each observing a different Coursera course still hit
 * coursera.org back to back, which is what gets a crawler blocked.
 *
 * In-process only. The monitor runs as one scheduled job, so a shared store
 * would add a dependency without changing the outcome.
 */
export class DomainRateLimiter {
  private readonly nextAllowedAt = new Map<string, number>();

  constructor(
    private readonly requestsPerMinute: number,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  private get minIntervalMs(): number {
    return Math.ceil(60_000 / Math.max(1, this.requestsPerMinute));
  }

  /** Resolves once the caller may issue a request against `domain`. */
  async acquire(domain: string | null): Promise<void> {
    const key = (domain ?? "unknown").toLowerCase();
    const now = this.clock();
    const earliest = this.nextAllowedAt.get(key) ?? 0;
    const waitMs = Math.max(0, earliest - now);

    // Reserve the slot before awaiting so concurrent callers queue behind it
    // rather than all reading the same stale value.
    this.nextAllowedAt.set(key, Math.max(now, earliest) + this.minIntervalMs);

    if (waitMs > 0) {
      await this.sleep(waitMs);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
