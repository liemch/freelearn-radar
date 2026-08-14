import { describe, expect, it } from "vitest";

import {
  couponRecheckPriority,
  extractUdemyOfferUrlsFromHtml,
  isPublicCoupon100Off,
  normalizeCouponCandidate,
  resolveCouponVerificationStatus,
} from "@/domain/coupon/coupon-service";

describe("normalizeCouponCandidate", () => {
  it("accepts known-positive Udemy coupon URL as DISCOVERED only", () => {
    const result = normalizeCouponCandidate({
      rawUrl:
        "https://www.udemy.com/course/example-course/?couponCode=TEST100OFF",
      sourceClaim: "100% OFF",
    });
    expect(result.status).toBe("DISCOVERED");
    expect(result.couponCode).toBe("TEST100OFF");
    expect(result.canonicalUrl).not.toContain("couponCode");
  });

  it("rejects missing coupon code", () => {
    const result = normalizeCouponCandidate({
      rawUrl: "https://www.udemy.com/course/example-course/",
    });
    expect(result.status).toBe("INVALID");
    expect(result.lastError).toBe("coupon_code_missing");
  });

  it("rejects malformed URL", () => {
    const result = normalizeCouponCandidate({ rawUrl: "not-a-url" });
    expect(result.status).toBe("INVALID");
  });
});

describe("resolveCouponVerificationStatus", () => {
  it("never promotes aggregator-only evidence to ACTIVE_100_OFF", () => {
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: false,
        blocked: false,
        priceAfterDiscount: 0,
        discountPercent: 100,
        couponRejected: false,
        pastExpiry: false,
      }),
    ).toBe("UNKNOWN");
  });

  it("marks ACTIVE_100_OFF only with official verification", () => {
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: true,
        blocked: false,
        priceAfterDiscount: 0,
        discountPercent: 100,
        couponRejected: false,
        pastExpiry: false,
      }),
    ).toBe("ACTIVE_100_OFF");
  });

  it("marks EXPIRED / INVALID / BLOCKED correctly", () => {
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: true,
        blocked: false,
        priceAfterDiscount: null,
        discountPercent: null,
        couponRejected: false,
        pastExpiry: true,
      }),
    ).toBe("EXPIRED");
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: true,
        blocked: false,
        priceAfterDiscount: null,
        discountPercent: null,
        couponRejected: true,
        pastExpiry: false,
      }),
    ).toBe("INVALID");
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: false,
        blocked: true,
        priceAfterDiscount: null,
        discountPercent: null,
        couponRejected: false,
        pastExpiry: false,
      }),
    ).toBe("BLOCKED");
  });
});

describe("isPublicCoupon100Off", () => {
  it("only ACTIVE_100_OFF surfaces as Coupon 100%", () => {
    expect(isPublicCoupon100Off("ACTIVE_100_OFF")).toBe(true);
    expect(isPublicCoupon100Off("ACTIVE_DISCOUNTED")).toBe(false);
    expect(isPublicCoupon100Off("DISCOVERED")).toBe(false);
    expect(isPublicCoupon100Off("EXPIRED")).toBe(false);
  });
});

describe("extractUdemyOfferUrlsFromHtml", () => {
  it("extracts coupon links only", () => {
    const html = `
      <a href="https://www.udemy.com/course/foo/?couponCode=ABC">deal</a>
      <a href="https://www.udemy.com/course/bar/">no coupon</a>
      <a href="https://evil.com/?u=https://udemy.com/course/x/?couponCode=Y">no</a>
    `;
    const urls = extractUdemyOfferUrlsFromHtml(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("couponCode=ABC");
  });
});

describe("couponRecheckPriority", () => {
  it("prioritizes fresh active coupons near expiry", () => {
    const now = new Date("2026-08-14T12:00:00Z");
    const hot = couponRecheckPriority({
      status: "ACTIVE_100_OFF",
      discoveredAt: new Date("2026-08-14T10:00:00Z"),
      verifiedAt: new Date("2026-08-14T10:30:00Z"),
      expiresAt: new Date("2026-08-14T18:00:00Z"),
      outboundClicks7d: 25,
      now,
    });
    const cold = couponRecheckPriority({
      status: "EXPIRED",
      discoveredAt: new Date("2026-07-01T00:00:00Z"),
      verifiedAt: new Date("2026-07-01T00:00:00Z"),
      expiresAt: new Date("2026-07-02T00:00:00Z"),
      outboundClicks7d: 0,
      now,
    });
    expect(hot).toBeGreaterThan(cold);
  });
});
