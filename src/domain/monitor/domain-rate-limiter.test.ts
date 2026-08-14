import { describe, expect, it } from "vitest";

import { DomainRateLimiter } from "@/domain/monitor/domain-rate-limiter";

/** Records requested sleeps and advances a virtual clock instead of waiting. */
function harness(rpm: number) {
  const sleeps: number[] = [];
  let clock = 0;

  const limiter = new DomainRateLimiter(
    rpm,
    async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    () => clock,
  );

  return { limiter, sleeps, advance: (ms: number) => (clock += ms) };
}

describe("DomainRateLimiter", () => {
  it("lets the first request through immediately", async () => {
    const { limiter, sleeps } = harness(20);
    await limiter.acquire("coursera.org");
    expect(sleeps).toEqual([]);
  });

  it("spaces consecutive requests to the same domain", async () => {
    const { limiter, sleeps } = harness(20);

    await limiter.acquire("coursera.org");
    await limiter.acquire("coursera.org");

    // 20/min → one request every 3s.
    expect(sleeps).toEqual([3_000]);
  });

  it("does not make one domain wait for another", async () => {
    const { limiter, sleeps } = harness(20);

    await limiter.acquire("coursera.org");
    await limiter.acquire("udemy.com");

    expect(sleeps).toEqual([]);
  });

  it("stops delaying once enough time has passed", async () => {
    const { limiter, sleeps, advance } = harness(20);

    await limiter.acquire("coursera.org");
    advance(5_000);
    await limiter.acquire("coursera.org");

    expect(sleeps).toEqual([]);
  });

  it("queues concurrent callers rather than releasing them together", async () => {
    const { limiter, sleeps } = harness(20);

    await Promise.all([
      limiter.acquire("coursera.org"),
      limiter.acquire("coursera.org"),
      limiter.acquire("coursera.org"),
    ]);

    // Each caller reserves its slot before awaiting, so the delays stack.
    expect(sleeps).toHaveLength(2);
    expect(Math.max(...sleeps)).toBeGreaterThanOrEqual(3_000);
  });

  it("treats an unknown domain as a single bucket", async () => {
    const { limiter, sleeps } = harness(60);

    await limiter.acquire(null);
    await limiter.acquire(null);

    expect(sleeps).toEqual([1_000]);
  });
});
