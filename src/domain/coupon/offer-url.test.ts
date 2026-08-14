import { describe, expect, it } from "vitest";

import {
  buildOfferUrl,
  parseCourseOfferUrl,
} from "@/domain/coupon/offer-url";
import { normalizeUrl } from "@/lib/url";

describe("parseCourseOfferUrl — known-positive coupon fixture", () => {
  const canonical = "https://www.udemy.com/course/example-course/";
  const offer = "https://www.udemy.com/course/example-course/?couponCode=TEST100OFF";

  it("keeps coupon_code and separates canonical from offer", () => {
    const parsed = parseCourseOfferUrl(offer);
    expect(parsed.couponCode).toBe("TEST100OFF");
    expect(parsed.canonicalUrl).toBe("https://udemy.com/course/example-course");
    expect(parsed.offerUrl).toContain("couponCode=TEST100OFF");
    expect(parsed.providerHint).toBe("udemy");
    expect(parsed.canonicalUrl).not.toBe(parsed.offerUrl);
  });

  it("does not invent a coupon when absent", () => {
    const parsed = parseCourseOfferUrl(canonical);
    expect(parsed.couponCode).toBeNull();
    expect(parsed.canonicalUrl).toBe(parsed.offerUrl);
  });

  it("preserves couponCode through normalizeUrl", () => {
    expect(normalizeUrl(offer)).toContain("couponCode=TEST100OFF");
  });

  it("strips tracking but keeps couponCode", () => {
    const mixed =
      "https://www.udemy.com/course/example-course/?utm_source=x&couponCode=KEEPME&fbclid=1";
    const parsed = parseCourseOfferUrl(mixed);
    expect(parsed.couponCode).toBe("KEEPME");
    expect(parsed.offerUrl).toContain("couponCode=KEEPME");
    expect(parsed.offerUrl).not.toContain("utm_source");
    expect(parsed.canonicalUrl).not.toContain("couponCode");
  });

  it("buildOfferUrl round-trips", () => {
    const built = buildOfferUrl(
      "https://udemy.com/course/example-course",
      "ABC123",
    );
    const parsed = parseCourseOfferUrl(built);
    expect(parsed.couponCode).toBe("ABC123");
    expect(parsed.canonicalUrl).toBe("https://udemy.com/course/example-course");
  });
});
