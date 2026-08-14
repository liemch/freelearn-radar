/**
 * M21.12 — Reliability / invariant hardening scenarios (unit level).
 */

import { describe, expect, it } from "vitest";

import { classifyAccessFromText, isPreviewOrTrialOnly } from "@/domain/access/access-classifier";
import {
  extractUdemyOfferUrlsFromHtml,
  normalizeCouponCandidate,
  resolveCouponVerificationStatus,
  isPublicCoupon100Off,
} from "@/domain/coupon/coupon-service";
import { parseCourseOfferUrl } from "@/domain/coupon/offer-url";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { resolveMediaStatus } from "@/domain/media/media-resolver";
import { DISCOVERY_BUDGET_CATEGORY_SLUGS } from "@/domain/taxonomy/multi-domain";
import { PUBLIC_LANGUAGE_SWITCHER, defaultLocale } from "@/lib/i18n/config";
import { assertSafeHttpUrl } from "@/lib/url";
import { validateImageUrl } from "@/services/images/course-image-service";

describe("M21.12 reliability scenarios", () => {
  it("handles malformed coupon URL without throwing publishable status", () => {
    const result = normalizeCouponCandidate({ rawUrl: "%%%%" });
    expect(result.status).toBe("INVALID");
    expect(isPublicCoupon100Off(result.status)).toBe(false);
  });

  it("handles missing coupon code", () => {
    const result = normalizeCouponCandidate({
      rawUrl: "https://udemy.com/course/x/",
    });
    expect(result.status).toBe("INVALID");
    expect(result.lastError).toBe("coupon_code_missing");
  });

  it("does not publish ACTIVE_100_OFF when official verification blocked", () => {
    expect(
      resolveCouponVerificationStatus({
        officialFetchOk: false,
        blocked: true,
        priceAfterDiscount: 0,
        discountPercent: 100,
        couponRejected: false,
        pastExpiry: false,
      }),
    ).toBe("BLOCKED");
  });

  it("expires coupons out of public Coupon 100% surface", () => {
    const status = resolveCouponVerificationStatus({
      officialFetchOk: true,
      blocked: false,
      priceAfterDiscount: null,
      discountPercent: null,
      couponRejected: false,
      pastExpiry: true,
    });
    expect(status).toBe("EXPIRED");
    expect(isPublicCoupon100Off(status)).toBe(false);
  });

  it("dedupes same coupon URL identity via parse", () => {
    const a = parseCourseOfferUrl(
      "https://www.udemy.com/course/foo/?couponCode=ABC&utm_source=x",
    );
    const b = parseCourseOfferUrl(
      "https://udemy.com/course/foo/?couponCode=ABC",
    );
    expect(a.canonicalUrl).toBe(b.canonicalUrl);
    expect(a.couponCode).toBe(b.couponCode);
    expect(a.offerUrl).toBe(b.offerUrl);
  });

  it("keeps multiple coupon codes as distinct offer identities", () => {
    const a = parseCourseOfferUrl(
      "https://udemy.com/course/foo/?couponCode=ONE",
    );
    const b = parseCourseOfferUrl(
      "https://udemy.com/course/foo/?couponCode=TWO",
    );
    expect(a.canonicalUrl).toBe(b.canonicalUrl);
    expect(a.offerUrl).not.toBe(b.offerUrl);
  });

  it("ignores junk HTML without coupon links", () => {
    expect(extractUdemyOfferUrlsFromHtml("<html><body>no deals</body></html>")).toEqual(
      [],
    );
  });

  it("image host unavailable → broken/fallback, course still has visual path", () => {
    const result = resolveMediaStatus({
      sourceUrl: "https://cdn.example.com/missing.jpg",
      storageUrl: null,
      fetchResult: { ok: false, reason: "network_error" },
      providerSlug: "udemy",
      categorySlug: "soft-skills",
    });
    expect(result.imageStatus).toBe("BROKEN");
    expect(result.imageResolvedUrl).toBeNull();
  });

  it("rejects SSRF image targets", () => {
    expect(validateImageUrl("http://169.254.169.254/latest/meta")).toBeNull();
    expect(validateImageUrl("https://localhost/x.png")).toBeNull();
  });

  it("rejects open-redirect-ish unsafe outbound schemes", () => {
    expect(() => assertSafeHttpUrl("javascript:alert(1)")).toThrow();
    expect(() => assertSafeHttpUrl("//evil.example")).toThrow();
  });

  it("FREE_PREVIEW is not free-list eligible and not conflated with FREE_FULL", () => {
    expect(isEligibleForFreeLists("FREE_PREVIEW")).toBe(false);
    expect(isPreviewOrTrialOnly("FREE_PREVIEW")).toBe(true);
    const classified = classifyAccessFromText({
      providerSlug: "coursera",
      text: "Free preview only",
    });
    expect(classified.access).toBe("FREE_PREVIEW");
  });

  it("discovery budget covers non-Tech domains", () => {
    expect(DISCOVERY_BUDGET_CATEGORY_SLUGS).toEqual(
      expect.arrayContaining([
        "soft-skills",
        "personal-development",
        "finance",
        "languages",
        "office-productivity",
      ]),
    );
    expect(DISCOVERY_BUDGET_CATEGORY_SLUGS).toEqual(
      expect.arrayContaining(["programming", "ai"]),
    );
  });

  it("Vietnamese-only public UI invariant holds", () => {
    expect(defaultLocale).toBe("vi");
    expect(PUBLIC_LANGUAGE_SWITCHER).toBe(false);
  });
});
