import { describe, expect, it } from "vitest";

import {
  buildOutboundUrl,
  computeFreshnessScore,
  computeFreeValueScore,
  computeRankingScore,
  rankCourses,
} from "@/domain/ranking/ranking";
import type { Course } from "@/db/schema";

describe("ranking", () => {
  it("scores freshness by age buckets", () => {
    const now = new Date("2026-08-13T00:00:00Z");
    expect(
      computeFreshnessScore(new Date("2026-08-10T00:00:00Z"), now),
    ).toBe(100);
    expect(
      computeFreshnessScore(new Date("2026-07-20T00:00:00Z"), now),
    ).toBe(60);
    expect(computeFreshnessScore(null, now)).toBe(10);
  });

  it("prefers fully free courses in free-value score", () => {
    expect(computeFreeValueScore("FREE_FULL")).toBeGreaterThan(
      computeFreeValueScore("FREE_AUDIT"),
    );
  });

  it("computes deterministic ranking score", () => {
    const score = computeRankingScore({
      qualityScore: 80,
      freshnessScore: 100,
      popularityScore: 40,
      freeValueScore: 100,
      editorialScore: 70,
    });
    expect(score).toBeCloseTo(80 * 0.3 + 100 * 0.25 + 40 * 0.15 + 100 * 0.2 + 70 * 0.1);
  });

  it("orders courses by ranking score", () => {
    const ranked = rankCourses([
      {
        id: "1",
        qualityScore: 50,
        editorScore: 50,
        priceType: "PAID",
        ratingCount: 0,
        publishedAt: new Date("2025-01-01"),
      },
      {
        id: "2",
        qualityScore: 90,
        editorScore: 90,
        priceType: "FREE_FULL",
        ratingCount: 500,
        publishedAt: new Date(),
      },
    ] as Course[]);

    expect(ranked[0]?.id).toBe("2");
  });

  it("builds outbound URLs with affiliate priority", () => {
    expect(
      buildOutboundUrl({
        affiliateUrl: "https://affiliate.example/x",
        outboundUrl: "https://provider.example/course",
        canonicalUrl: "https://provider.example/course",
      }),
    ).toBe("https://affiliate.example/x");

    expect(
      buildOutboundUrl(
        {
          affiliateUrl: null,
          outboundUrl: "https://provider.example/course",
          canonicalUrl: "https://provider.example/course",
        },
        {
          affiliateEnabled: true,
          affiliateTemplate: "https://aff.example/?u={url}",
        },
      ),
    ).toContain("aff.example");
  });
});
