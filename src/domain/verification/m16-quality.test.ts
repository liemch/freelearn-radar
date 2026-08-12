import { describe, expect, it } from "vitest";

import { assessMetadataCompleteness } from "@/domain/quality/metadata-completeness";
import { confidenceBand, shouldRouteToExtraReview } from "@/domain/quality/confidence";
import {
  prefilterCandidate,
  shouldReuseAnalysis,
  simpleContentHash,
} from "@/domain/quality/candidate-prefilter";
import { suggestSoftDuplicate } from "@/domain/quality/title-similarity";
import { detectCourseChanges } from "@/domain/verification/change-detection";
import { decideExpiration } from "@/domain/verification/expiration";
import {
  getVerificationIntervalDays,
  isVerificationDue,
} from "@/domain/verification/freshness-policy";
import { computeRecheckPriority } from "@/domain/verification/priority";
import { assessCourseTrust, trustRankingMultiplier } from "@/domain/verification/trust";
import { produceVerificationResult } from "@/domain/verification/verification-service";
import {
  computeFreshnessScore,
  computeRankingScore,
  rankCourses,
} from "@/domain/ranking/ranking";
import type { Course } from "@/db/schema";

describe("trust model", () => {
  it("marks never-verified courses as UNVERIFIED", () => {
    const trust = assessCourseTrust({
      lastVerifiedAt: null,
      priceType: "FREE_FULL",
      certificateType: "UNKNOWN",
      pricingConfidence: 0.8,
      certificateConfidence: 0.2,
      metadataCompleteness: 80,
      sourceScore: 70,
    });
    expect(trust.state).toBe("UNVERIFIED");
  });

  it("marks stale verification as STALE", () => {
    const now = new Date("2026-08-13");
    const trust = assessCourseTrust({
      lastVerifiedAt: new Date("2026-05-01"),
      verificationSucceeded: true,
      priceType: "FREE_FULL",
      certificateType: "FREE_CERTIFICATE",
      pricingConfidence: 0.8,
      certificateConfidence: 0.8,
      metadataCompleteness: 90,
      sourceScore: 80,
      now,
    });
    expect(trust.state).toBe("STALE");
  });
});

describe("freshness & priority", () => {
  it("checks coupons more often than microsoft learn full free", () => {
    expect(
      getVerificationIntervalDays({ priceType: "FREE_WITH_COUPON" }),
    ).toBeLessThan(
      getVerificationIntervalDays({
        priceType: "FREE_FULL",
        providerSlug: "microsoft-learn",
      }),
    );
  });

  it("prioritizes overdue coupon courses as CRITICAL/HIGH", () => {
    const result = computeRecheckPriority({
      lastVerifiedAt: new Date("2026-08-01"),
      priceType: "FREE_WITH_COUPON",
      ratingCount: 2000,
      now: new Date("2026-08-13"),
    });
    expect(["CRITICAL", "HIGH"]).toContain(result.priority);
  });

  it("marks never-verified as due", () => {
    expect(
      isVerificationDue({ lastVerifiedAt: null, priceType: "FREE_AUDIT" }),
    ).toBe(true);
  });
});

describe("expiration & change detection", () => {
  it("expires published course when paid with confidence", () => {
    const decision = decideExpiration({
      currentStatus: "PUBLISHED",
      observedPriceType: "PAID",
      availability: "AVAILABLE",
      pricingConfidence: 0.85,
    });
    expect(decision.nextStatus).toBe("EXPIRED");
    expect(decision.shouldUpdate).toBe(true);
  });

  it("marks unavailable when evidence says so", () => {
    const decision = decideExpiration({
      currentStatus: "PUBLISHED",
      observedPriceType: "FREE_FULL",
      availability: "UNAVAILABLE",
      pricingConfidence: 0.8,
    });
    expect(decision.nextStatus).toBe("UNAVAILABLE");
  });

  it("detects FREE→PAID change", () => {
    const changes = detectCourseChanges({
      previous: {
        priceType: "FREE_FULL",
        certificateType: "FREE_CERTIFICATE",
        status: "PUBLISHED",
        title: "Python",
        canonicalUrl: "https://example.com/a",
      },
      next: {
        priceType: "PAID",
        certificateType: "FREE_CERTIFICATE",
        status: "EXPIRED",
        title: "Python",
        canonicalUrl: "https://example.com/a",
      },
    });
    expect(changes.some((c) => c.kind === "PRICE_CHANGED")).toBe(true);
  });
});

describe("verification engine", () => {
  it("produces verification with evidence and history-friendly notes", () => {
    const result = produceVerificationResult(
      {
        id: "c1",
        title: "Python",
        canonicalUrl: "https://coursera.org/learn/python",
        status: "PUBLISHED",
        priceType: "FREE_AUDIT",
        certificateType: "UNKNOWN",
        providerSlug: "coursera",
        providerName: "Coursera",
        categoryCount: 1,
      },
      {
        text: "Free to audit. Paid certificate available for $49.",
        sourceUrl: "https://coursera.org/learn/python",
        method: "PAGE_METADATA",
        availability: "AVAILABLE",
      },
      new Date("2026-08-13"),
    );

    expect(result.priceType).toBe("FREE_AUDIT");
    expect(result.certificateType).toBe("PAID_CERTIFICATE");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.status).toBe("VERIFIED");
  });

  it("fails closed on empty evidence", () => {
    const result = produceVerificationResult(
      {
        id: "c1",
        title: "X",
        canonicalUrl: "https://example.com/x",
        status: "PUBLISHED",
        priceType: "FREE_FULL",
        certificateType: "UNKNOWN",
      },
      { text: "", availability: "UNKNOWN" },
    );
    expect(result.status).toBe("FAILED");
  });
});

describe("dedup soft matching", () => {
  it("suggests identical titles same provider", () => {
    expect(
      suggestSoftDuplicate({
        titleA: "Python Basics",
        titleB: "Python Basics",
        providerA: "coursera",
        providerB: "coursera",
      }).suggested,
    ).toBe(true);
  });

  it("does not merge Basics vs Basics Advanced", () => {
    expect(
      suggestSoftDuplicate({
        titleA: "Python Basics",
        titleB: "Python Basics Advanced",
        providerA: "coursera",
        providerB: "coursera",
      }).suggested,
    ).toBe(false);
  });
});

describe("discovery prefilter & AI cost", () => {
  it("rejects blog and login pages", () => {
    expect(
      prefilterCandidate({
        url: "https://example.com/blog/announcing-x",
        title: "News",
      }).accept,
    ).toBe(false);
    expect(
      prefilterCandidate({
        url: "https://example.com/login",
        title: "Login",
      }).accept,
    ).toBe(false);
  });

  it("accepts learning paths", () => {
    expect(
      prefilterCandidate({
        url: "https://learn.microsoft.com/learning-path/azure",
        title: "Azure path",
      }).accept,
    ).toBe(true);
  });

  it("reuses analysis when hash unchanged", () => {
    const hash = simpleContentHash(["a", "b"]);
    expect(
      shouldReuseAnalysis({
        previousContentHash: hash,
        currentContentHash: hash,
        previousAnalyzedAt: new Date(),
      }),
    ).toBe(true);
  });
});

describe("confidence routing", () => {
  it("routes low confidence to extra review", () => {
    expect(shouldRouteToExtraReview(0.4)).toBe(true);
    expect(shouldRouteToExtraReview(0.9)).toBe(false);
    expect(confidenceBand(0.4)).toBe("LOW");
  });
});

describe("metadata completeness", () => {
  it("scores missing optional unknowns lower", () => {
    const low = assessMetadataCompleteness({ title: "A" });
    const high = assessMetadataCompleteness({
      title: "A",
      provider: "Coursera",
      canonicalUrl: "https://x.com/a",
      description: "desc",
      hasCategory: true,
      level: "BEGINNER",
      language: "en",
      durationMinutes: 60,
      priceType: "FREE_FULL",
      certificateType: "FREE_CERTIFICATE",
      lastVerifiedAt: new Date(),
    });
    expect(high.score).toBeGreaterThan(low.score);
  });
});

describe("ranking trust penalty", () => {
  it("penalizes stale/unverified vs verified freshness", () => {
    const now = new Date("2026-08-13");
    const fresh = computeFreshnessScore(
      new Date("2026-08-10"),
      now,
      new Date("2026-08-12"),
    );
    const stale = computeFreshnessScore(
      new Date("2026-01-01"),
      now,
      new Date("2026-01-02"),
    );
    expect(fresh).toBeGreaterThan(stale);

    const verifiedScore = computeRankingScore({
      qualityScore: 80,
      freshnessScore: 80,
      popularityScore: 40,
      freeValueScore: 100,
      editorialScore: 70,
      trustMultiplier: trustRankingMultiplier("VERIFIED"),
    });
    const staleScore = computeRankingScore({
      qualityScore: 80,
      freshnessScore: 80,
      popularityScore: 40,
      freeValueScore: 100,
      editorialScore: 70,
      trustMultiplier: trustRankingMultiplier("STALE"),
    });
    expect(verifiedScore).toBeGreaterThan(staleScore);
  });

  it("does not rank high merely on AI quality when unverified/stale", () => {
    const now = new Date("2026-08-13");
    const ranked = rankCourses(
      [
        {
          id: "ai-high-stale",
          qualityScore: 99,
          editorScore: 50,
          priceType: "FREE_FULL",
          ratingCount: 10,
          publishedAt: new Date("2025-01-01"),
          lastVerifiedAt: new Date("2025-01-02"),
          title: "A",
          canonicalUrl: "https://a.example/a",
          certificateType: "UNKNOWN",
          language: null,
          level: "UNKNOWN",
          durationMinutes: null,
          description: null,
          shortDescription: null,
          instructor: null,
        },
        {
          id: "solid",
          qualityScore: 70,
          editorScore: 70,
          priceType: "FREE_FULL",
          ratingCount: 200,
          publishedAt: new Date("2026-08-01"),
          lastVerifiedAt: new Date("2026-08-12"),
          title: "B",
          canonicalUrl: "https://b.example/b",
          certificateType: "FREE_CERTIFICATE",
          language: "en",
          level: "BEGINNER",
          durationMinutes: 120,
          description: "ok",
          shortDescription: "ok",
          instructor: "x",
        },
      ] as Course[],
      now,
    );

    expect(ranked[0]?.id).toBe("solid");
  });
});
