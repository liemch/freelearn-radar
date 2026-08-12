import { describe, expect, it } from "vitest";

import {
  assertSafeHttpUrl,
  isValidHttpUrl,
  normalizeUrl,
} from "@/lib/url";

describe("normalizeUrl", () => {
  it("removes tracking params and normalizes protocol/host", () => {
    expect(
      normalizeUrl(
        "http://www.coursera.org/learn/python/?utm_source=x&fbclid=1",
      ),
    ).toBe("https://coursera.org/learn/python");
  });

  it("rejects invalid and unsafe URLs", () => {
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("data:text/html,hi")).toBe(false);
    expect(() => normalizeUrl("not-a-url")).toThrow();
    expect(() => assertSafeHttpUrl("javascript:alert(1)")).toThrow(/Unsafe/);
    expect(() => assertSafeHttpUrl("//evil.example/path")).toThrow(
      /Protocol-relative/,
    );
  });

  it("accepts https course URLs", () => {
    expect(assertSafeHttpUrl("https://coursera.org/learn/python")).toContain(
      "https://",
    );
  });
});
