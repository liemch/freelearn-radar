import { describe, expect, it } from "vitest";

import { produceVerificationResult } from "@/domain/verification/verification-service";
import { computeRecheckPriority } from "@/domain/verification/priority";
import { assessCourseTrust } from "@/domain/verification/trust";
import { rankCourses } from "@/domain/ranking/ranking";
import type { Course } from "@/db/schema";

type SimCourse = {
  id: string;
  title: string;
  canonicalUrl: string;
  status: Course["status"];
  priceType: Course["priceType"];
  certificateType: Course["certificateType"];
  lastVerifiedAt: Date | null;
  publishedAt: Date;
  qualityScore: number;
  editorScore: number;
  ratingCount: number;
  history: Array<{ day: number; priceType: string; status: string }>;
};

/**
 * Deterministic multi-day catalog simulation (fixture, not production code).
 * DAY1: A free, B coupon, C audit
 * DAY5: B coupon expires → PAID/EXPIRED
 * DAY10: A still free
 * DAY20: C unavailable
 */
describe("M16 multi-day verification simulation", () => {
  it("tracks statuses, history, trust, ranking, and priority across days", () => {
    const catalog: SimCourse[] = [
      {
        id: "A",
        title: "Course A",
        canonicalUrl: "https://example.com/a",
        status: "PUBLISHED",
        priceType: "FREE_FULL",
        certificateType: "FREE_CERTIFICATE",
        lastVerifiedAt: new Date("2026-08-01"),
        publishedAt: new Date("2026-08-01"),
        qualityScore: 80,
        editorScore: 70,
        ratingCount: 100,
        history: [],
      },
      {
        id: "B",
        title: "Course B",
        canonicalUrl: "https://example.com/b",
        status: "PUBLISHED",
        priceType: "FREE_WITH_COUPON",
        certificateType: "UNKNOWN",
        lastVerifiedAt: new Date("2026-08-01"),
        publishedAt: new Date("2026-08-01"),
        qualityScore: 75,
        editorScore: 60,
        ratingCount: 500,
        history: [],
      },
      {
        id: "C",
        title: "Course C",
        canonicalUrl: "https://example.com/c",
        status: "PUBLISHED",
        priceType: "FREE_AUDIT",
        certificateType: "PAID_CERTIFICATE",
        lastVerifiedAt: new Date("2026-08-01"),
        publishedAt: new Date("2026-08-01"),
        qualityScore: 70,
        editorScore: 60,
        ratingCount: 50,
        history: [],
      },
    ];

    const evidenceByDay: Record<
      number,
      Record<string, { text: string; availability: "AVAILABLE" | "UNAVAILABLE" }>
    > = {
      1: {
        A: { text: "Completely free full access", availability: "AVAILABLE" },
        B: { text: "Free with coupon SAVE100", availability: "AVAILABLE" },
        C: { text: "Free to audit", availability: "AVAILABLE" },
      },
      5: {
        A: { text: "Completely free full access", availability: "AVAILABLE" },
        B: { text: "Buy now for $49. Coupon expired.", availability: "AVAILABLE" },
        C: { text: "Free to audit", availability: "AVAILABLE" },
      },
      10: {
        A: { text: "Completely free full access", availability: "AVAILABLE" },
        B: { text: "Buy now for $49", availability: "AVAILABLE" },
        C: { text: "Free to audit", availability: "AVAILABLE" },
      },
      20: {
        A: { text: "Completely free full access", availability: "AVAILABLE" },
        B: { text: "Buy now for $49", availability: "AVAILABLE" },
        C: { text: "Course removed", availability: "UNAVAILABLE" },
      },
    };

    for (const day of [1, 5, 10, 20] as const) {
      const now = new Date(Date.UTC(2026, 7, day));
      for (const course of catalog) {
        const evidence = evidenceByDay[day][course.id];
        const result = produceVerificationResult(
          {
            id: course.id,
            title: course.title,
            canonicalUrl: course.canonicalUrl,
            status: course.status,
            priceType: course.priceType,
            certificateType: course.certificateType,
            lastVerifiedAt: course.lastVerifiedAt,
            providerName: "Example",
            categoryCount: 1,
          },
          {
            text: evidence.text,
            availability: evidence.availability,
            method: "PAGE_METADATA",
            sourceUrl: course.canonicalUrl,
          },
          now,
        );

        course.priceType = result.priceType;
        course.certificateType = result.certificateType;
        course.status = result.nextCourseStatus;
        course.lastVerifiedAt = result.observedAt;
        course.history.push({
          day,
          priceType: result.priceType,
          status: result.nextCourseStatus,
        });
      }
    }

    const courseA = catalog.find((c) => c.id === "A")!;
    const courseB = catalog.find((c) => c.id === "B")!;
    const courseC = catalog.find((c) => c.id === "C")!;

    expect(courseA.history.map((h) => h.priceType)).toEqual([
      "FREE_FULL",
      "FREE_FULL",
      "FREE_FULL",
      "FREE_FULL",
    ]);
    expect(courseB.history.find((h) => h.day === 5)?.priceType).toBe("PAID");
    expect(courseB.history.find((h) => h.day === 5)?.status).toBe("EXPIRED");
    expect(courseC.history.find((h) => h.day === 20)?.status).toBe("UNAVAILABLE");

    // History preserved (4 snapshots each)
    expect(courseA.history).toHaveLength(4);
    expect(courseB.history).toHaveLength(4);

    const now = new Date("2026-08-20");
    const trustA = assessCourseTrust({
      lastVerifiedAt: courseA.lastVerifiedAt,
      verificationSucceeded: true,
      priceType: courseA.priceType,
      certificateType: courseA.certificateType,
      pricingConfidence: 0.8,
      certificateConfidence: 0.8,
      metadataCompleteness: 90,
      sourceScore: 80,
      now,
    });
    expect(["VERIFIED", "LIKELY_VALID"]).toContain(trustA.state);

    const priorityB = computeRecheckPriority({
      lastVerifiedAt: courseB.lastVerifiedAt,
      priceType: courseB.priceType,
      previousVerificationFailed: false,
      ratingCount: courseB.ratingCount,
      now,
    });
    expect(priorityB.score).toBeGreaterThan(0);

    const ranked = rankCourses(
      catalog.map((course) => ({
        ...course,
        language: "en",
        level: "BEGINNER",
        durationMinutes: 60,
        description: "d",
        shortDescription: "d",
        instructor: "i",
        canonicalUrl: course.canonicalUrl,
      })) as unknown as Course[],
      now,
    );

    // Active free course should outrank expired/unavailable
    expect(ranked[0]?.id).toBe("A");
  });
});
