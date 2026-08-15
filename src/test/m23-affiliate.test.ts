import { afterEach, describe, expect, it } from "vitest";

import {
  isAffiliateProductActive,
  validateAffiliateProductUrl,
} from "@/domain/affiliate/affiliate-product";
import { isCommerceAffiliateEnabled } from "@/domain/affiliate/resolve-placements";

const originalMonetization = process.env.FEATURE_MONETIZATION;
const originalCommerce = process.env.FEATURE_COMMERCE_AFFILIATE;

afterEach(() => {
  if (originalMonetization === undefined) {
    delete process.env.FEATURE_MONETIZATION;
  } else {
    process.env.FEATURE_MONETIZATION = originalMonetization;
  }
  if (originalCommerce === undefined) {
    delete process.env.FEATURE_COMMERCE_AFFILIATE;
  } else {
    process.env.FEATURE_COMMERCE_AFFILIATE = originalCommerce;
  }
});

describe("M23 affiliate product operations", () => {
  it("accepts Shopee/Lazada HTTPS URLs and preserves query parameters", () => {
    const shopee = validateAffiliateProductUrl(
      "https://affiliate.shopee.vn/product/1?utm_source=radar&sub_id=course",
      "SHOPEE",
    );
    expect(new URL(shopee).searchParams.get("sub_id")).toBe("course");
    expect(() =>
      validateAffiliateProductUrl("https://pages.lazada.vn/item/2", "LAZADA"),
    ).not.toThrow();
  });

  it("rejects unsafe schemes, foreign hosts, and open redirects", () => {
    expect(() =>
      validateAffiliateProductUrl("javascript:alert(1)", "SHOPEE"),
    ).toThrow();
    expect(() =>
      validateAffiliateProductUrl("data:text/html,hello", "LAZADA"),
    ).toThrow();
    expect(() =>
      validateAffiliateProductUrl("https://evil.example/item", "SHOPEE"),
    ).toThrow();
    expect(() =>
      validateAffiliateProductUrl(
        "https://shopee.vn/redirect?url=https%3A%2F%2Fevil.example",
        "SHOPEE",
      ),
    ).toThrow(/chuyển hướng ngoài/);
  });

  it("hides inactive and out-of-schedule products", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    expect(
      isAffiliateProductActive(
        { status: "INACTIVE", startsAt: null, endsAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isAffiliateProductActive(
        {
          status: "ACTIVE",
          startsAt: new Date("2026-08-16T00:00:00Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("keeps public commerce products off when the feature is disabled", () => {
    process.env.FEATURE_MONETIZATION = "true";
    process.env.FEATURE_COMMERCE_AFFILIATE = "false";
    expect(isCommerceAffiliateEnabled()).toBe(false);
  });
});
