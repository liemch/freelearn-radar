import { describe, expect, it } from "vitest";

import { toDateOrNull, toNumberOrNull } from "@/db/sql-values";

/**
 * Regression: `getCatalogTrustSignals` typed a raw `max(last_verified_at)` as
 * `sql<Date | null>` and passed the result straight to a helper that called
 * `.getTime()`. The annotation is an assertion Drizzle never enforces on a raw
 * fragment, so the driver handed back a string. It typechecked, it built, and
 * it threw `a.getTime is not a function` on the first request with real data —
 * taking down the homepage and the admin dashboard together.
 */
describe("toDateOrNull", () => {
  it("parses the string a raw timestamptz aggregate actually returns", () => {
    const parsed = toDateOrNull("2026-08-14 10:26:25.47+00");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe("2026-08-14T10:26:25.470Z");
  });

  it("passes a Date through untouched", () => {
    const date = new Date("2026-08-14T00:00:00Z");
    expect(toDateOrNull(date)).toBe(date);
  });

  it("returns null for an empty aggregate", () => {
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull(undefined)).toBeNull();
  });

  it("returns null rather than an Invalid Date", () => {
    expect(toDateOrNull("not a timestamp")).toBeNull();
    expect(toDateOrNull({})).toBeNull();
  });

  it("produces a value that survives getTime()", () => {
    const parsed = toDateOrNull("2026-08-14 10:26:25.47+00");
    expect(() => parsed?.getTime()).not.toThrow();
    expect(typeof parsed?.getTime()).toBe("number");
  });
});

describe("toNumberOrNull", () => {
  it("parses a numeric aggregate returned as a string", () => {
    expect(toNumberOrNull("0.950")).toBe(0.95);
  });

  it("passes a finite number through", () => {
    expect(toNumberOrNull(12)).toBe(12);
  });

  it("rejects values that are not numbers", () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull("abc")).toBeNull();
    expect(toNumberOrNull(Number.NaN)).toBeNull();
  });
});
