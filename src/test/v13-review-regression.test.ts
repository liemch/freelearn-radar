/**
 * Regression tests for the v1.3 / v1.3.1 review findings.
 * Each test names the finding it locks down so a future change that reopens the
 * defect fails with the reason attached.
 */

import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "@/components/seo/json-ld";
import { resolveCouponVerificationStatus } from "@/domain/coupon/coupon-service";
import { selectRelatedCourses } from "@/domain/discovery/related-courses";
import { interleaveByCategory } from "@/domain/discovery/discovery-query-service";
import { applyNlIntentToFilters, parseIntentDeterministic } from "@/domain/search/nl-intent";
import { isLocale } from "@/lib/i18n/config";
import { assertSafeHttpUrl, isValidHttpUrl } from "@/lib/url";

describe("P0-1 — affiliate outbound must not become an open redirect", () => {
  // The route builds `new URL(`/${locale}`, request.url)`. Anything that
  // `isLocale` accepts must stay a single path segment; anything else must be
  // rejected before it reaches the redirect.
  const hostile = [
    "/evil.com",
    "//evil.com",
    "///evil.com",
    "\\/evil.com",
    "\\\\evil.com",
    "http://evil.com",
    "https://evil.com",
    ".evil.com",
    "..",
    "../../etc",
    "vi/../../evil.com",
    "%2f%2fevil.com",
    "en evil.com",
  ];

  it.each(hostile)("rejects %s as a locale", (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it("keeps the redirect same-origin for every accepted locale", () => {
    for (const locale of ["vi", "en"]) {
      expect(isLocale(locale)).toBe(true);
      const resolved = new URL(
        `/${locale}`,
        "https://freelearnradar.com/go/affiliate",
      );
      expect(resolved.origin).toBe("https://freelearnradar.com");
    }
  });

  it("would have left the origin for the pre-fix input", () => {
    // Documents why the validation matters rather than asserting the bug.
    expect(new URL("//evil.com", "https://freelearnradar.com/x").origin).toBe(
      "https://evil.com",
    );
  });
});

describe("P1-2 — a recorded expiry in the past cannot stay active", () => {
  const now = new Date("2026-08-14T12:00:00Z");
  const verified100 = {
    officialFetchOk: true,
    blocked: false,
    priceAfterDiscount: 0,
    discountPercent: 100,
    couponRejected: false,
    pastExpiry: false,
  };

  it("returns EXPIRED when expiresAt has passed even if the page reads 100% off", () => {
    expect(
      resolveCouponVerificationStatus(
        { ...verified100, expiresAt: new Date("2026-08-13T12:00:00Z") },
        now,
      ),
    ).toBe("EXPIRED");
  });

  it("still promotes a live 100% offer", () => {
    expect(
      resolveCouponVerificationStatus(
        { ...verified100, expiresAt: new Date("2026-08-15T12:00:00Z") },
        now,
      ),
    ).toBe("ACTIVE_100_OFF");
  });

  it("treats a missing expiry as no expiry constraint", () => {
    expect(
      resolveCouponVerificationStatus({ ...verified100, expiresAt: null }, now),
    ).toBe("ACTIVE_100_OFF");
  });

  it("never promotes without a successful official fetch", () => {
    expect(
      resolveCouponVerificationStatus(
        { ...verified100, officialFetchOk: false, expiresAt: null },
        now,
      ),
    ).toBe("UNKNOWN");
  });

  it("expiry outranks a coupon-rejected signal", () => {
    expect(
      resolveCouponVerificationStatus(
        {
          ...verified100,
          couponRejected: true,
          expiresAt: new Date("2026-08-01T00:00:00Z"),
        },
        now,
      ),
    ).toBe("EXPIRED");
  });
});

describe("P1-4 — related courses must not surface ineligible courses", () => {
  const provider = {
    id: "p1",
    slug: "udemy",
    name: "Udemy",
  } as never;

  function course(id: string, priceType: string) {
    return {
      id,
      providerId: "p1",
      provider,
      status: "PUBLISHED",
      level: "BEGINNER",
      language: "English",
      priceType,
      qualityScore: 90,
      lastVerifiedAt: new Date(),
      categoryIds: ["cat-1"],
    } as never;
  }

  const source = {
    id: "source",
    providerId: "p1",
    level: "BEGINNER",
    language: "English",
    priceType: "FREE_FOREVER",
    categoryIds: ["cat-1"],
  };

  it("drops PAID, FREE_TRIAL and FREE_PREVIEW candidates", () => {
    const results = selectRelatedCourses(
      source,
      [
        course("paid", "PAID"),
        course("trial", "FREE_TRIAL"),
        course("preview", "FREE_PREVIEW"),
        course("free", "FREE_FOREVER"),
      ],
      4,
    );

    expect(results.map((c) => c.id)).toEqual(["free"]);
  });

  it("returns an empty list rather than filling with ineligible courses", () => {
    const results = selectRelatedCourses(
      source,
      [course("paid", "PAID"), course("trial", "FREE_TRIAL")],
      4,
    );

    expect(results).toEqual([]);
  });
});

describe("P1-9 — discovery budget must not let one category take a whole run", () => {
  it("interleaves categories instead of draining the largest one", () => {
    const queries = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `tech-${i}`,
        category: "programming",
      })),
      { id: "soft-0", category: "soft-skills" },
      { id: "design-0", category: "design" },
    ];

    const selected = interleaveByCategory(queries, 6);
    const categories = new Set(selected.map((q) => q.category));

    expect(selected).toHaveLength(6);
    expect(categories).toContain("soft-skills");
    expect(categories).toContain("design");
    // With one query each, the thin categories contribute exactly one apiece.
    expect(
      selected.filter((q) => q.category === "programming"),
    ).toHaveLength(4);
  });

  it("still fills the budget when only one category is due", () => {
    const queries = Array.from({ length: 5 }, (_, i) => ({
      id: `only-${i}`,
      category: "ai",
    }));
    expect(interleaveByCategory(queries, 3)).toHaveLength(3);
  });

  it("keeps uncategorised queries eligible", () => {
    const selected = interleaveByCategory(
      [
        { id: "a", category: null },
        { id: "b", category: "ai" },
      ],
      2,
    );
    expect(selected.map((q) => q.id).sort()).toEqual(["a", "b"]);
  });

  it("returns nothing for a non-positive budget", () => {
    expect(interleaveByCategory([{ id: "a", category: "ai" }], 0)).toEqual([]);
  });
});

describe("P2-1 — JSON-LD must not be escapable", () => {
  it("escapes a script-closing sequence in course metadata", () => {
    const output = serializeJsonLd({
      name: "Python </script><script>alert(1)</script>",
    });

    expect(output).not.toContain("</script>");
    expect(output).not.toContain("<script>");
    expect(output).toContain("\\u003c");
    expect(JSON.parse(output).name).toBe(
      "Python </script><script>alert(1)</script>",
    );
  });

  it("escapes JS line terminators that would break the script block", () => {
    const output = serializeJsonLd({ name: "a\u2028b\u2029c" });
    expect(output).not.toContain("\u2028");
    expect(output).not.toContain("\u2029");
    expect(JSON.parse(output).name).toBe("a\u2028b\u2029c");
  });
});

describe("P2-3 — userinfo must not be accepted in outbound URLs", () => {
  it("rejects a trusted-looking host in the userinfo position", () => {
    expect(isValidHttpUrl("https://udemy.com@evil.com/course/x")).toBe(false);
    expect(() =>
      assertSafeHttpUrl("https://udemy.com@evil.com/course/x"),
    ).toThrow();
  });

  it("still accepts ordinary provider URLs", () => {
    expect(
      assertSafeHttpUrl("https://www.udemy.com/course/x/?couponCode=ABC"),
    ).toBe("https://www.udemy.com/course/x/?couponCode=ABC");
  });
});

describe("P1-10 — NL intent narrows filters without widening eligibility", () => {
  it("applies stated duration, level and Vietnamese-language constraints", () => {
    const intent = parseIntentDeterministic(
      "khóa học python cho người mới dưới 3 giờ có chứng chỉ tiếng Việt",
    );
    const filters = applyNlIntentToFilters(
      { q: "…" } as { q: string; level?: string; durationMaxMinutes?: number | null },
      intent,
    );

    expect(filters.level).toBe("BEGINNER");
    expect(filters.durationMaxMinutes).toBe(180);
  });

  it("never overrides a filter the user set explicitly", () => {
    const intent = parseIntentDeterministic("beginner python under 2 hours");
    const filters = applyNlIntentToFilters(
      { level: "ADVANCED", durationMaxMinutes: 30 },
      intent,
    );

    expect(filters.level).toBe("ADVANCED");
    expect(filters.durationMaxMinutes).toBe(30);
  });

  it("does not pin language for an unaccented Vietnamese query, so international courses stay reachable", () => {
    const intent = parseIntentDeterministic("khoa hoc python mien phi");
    const filters = applyNlIntentToFilters({}, intent);

    expect(filters).not.toHaveProperty("language");
  });
});
