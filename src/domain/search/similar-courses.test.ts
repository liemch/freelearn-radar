import { describe, expect, it } from "vitest";

import type { RelatedCourseInput } from "@/domain/discovery/related-courses";
import { selectSimilarCourses } from "@/domain/search/similar-courses";

const NOW = new Date("2026-08-14T00:00:00Z");

function makeCourse(
  overrides: Partial<RelatedCourseInput> & { id: string; providerId: string },
): RelatedCourseInput {
  return {
    title: `Course ${overrides.id}`,
    slug: `course-${overrides.id}`,
    status: "PUBLISHED",
    priceType: "FREE_FULL",
    certificateType: "NO_CERTIFICATE",
    level: "BEGINNER",
    language: "English",
    durationMinutes: 120,
    qualityScore: 60,
    canonicalUrl: `https://example.com/${overrides.id}`,
    description: "A course description long enough to count.",
    shortDescription: "Short description.",
    instructor: "Instructor",
    lastVerifiedAt: new Date("2026-08-10T00:00:00Z"),
    categoryIds: ["cat-1"],
    provider: { name: `Provider ${overrides.providerId}` },
    ...overrides,
  } as unknown as RelatedCourseInput;
}

const SOURCE = {
  id: "source",
  providerId: "p-source",
  level: "BEGINNER",
  language: "English",
  priceType: "FREE_FULL",
  categoryIds: ["cat-1"],
};

describe("selectSimilarCourses", () => {
  it("caps results at 2 per provider by default", () => {
    const candidates = [
      makeCourse({ id: "a1", providerId: "p1", qualityScore: 90 }),
      makeCourse({ id: "a2", providerId: "p1", qualityScore: 85 }),
      makeCourse({ id: "a3", providerId: "p1", qualityScore: 80 }),
      makeCourse({ id: "b1", providerId: "p2", qualityScore: 70 }),
      makeCourse({ id: "b2", providerId: "p2", qualityScore: 65 }),
      makeCourse({ id: "c1", providerId: "p3", qualityScore: 60 }),
    ];
    const results = selectSimilarCourses(SOURCE, candidates, 6, { now: NOW });
    const fromP1 = results.filter((c) => c.providerId === "p1");
    expect(fromP1).toHaveLength(2);
    expect(results.map((c) => c.id)).not.toContain("a3");
    expect(results).toHaveLength(5);
  });

  it("respects a custom maxPerProvider", () => {
    const candidates = [
      makeCourse({ id: "a1", providerId: "p1", qualityScore: 90 }),
      makeCourse({ id: "a2", providerId: "p1", qualityScore: 85 }),
      makeCourse({ id: "b1", providerId: "p2", qualityScore: 70 }),
    ];
    const results = selectSimilarCourses(SOURCE, candidates, 6, {
      maxPerProvider: 1,
      now: NOW,
    });
    expect(results.filter((c) => c.providerId === "p1")).toHaveLength(1);
    expect(results).toHaveLength(2);
  });

  it("excludes the source course and non-published candidates", () => {
    const candidates = [
      makeCourse({ id: "source", providerId: "p1" }),
      makeCourse({
        id: "draft",
        providerId: "p1",
        status: "DRAFT",
      } as never),
      makeCourse({ id: "ok", providerId: "p1" }),
    ];
    const results = selectSimilarCourses(SOURCE, candidates, 6, { now: NOW });
    expect(results.map((c) => c.id)).toEqual(["ok"]);
  });

  it("never returns price types excluded from free surfaces", () => {
    const candidates = [
      makeCourse({ id: "paid", providerId: "p1", priceType: "PAID" } as never),
      makeCourse({
        id: "trial",
        providerId: "p2",
        priceType: "FREE_TRIAL",
      } as never),
      makeCourse({ id: "free", providerId: "p3" }),
    ];
    const results = selectSimilarCourses(SOURCE, candidates, 6, { now: NOW });
    expect(results.map((c) => c.id)).toEqual(["free"]);
  });

  it("honors the overall limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeCourse({ id: `c${i}`, providerId: `p${i}` }),
    );
    const results = selectSimilarCourses(SOURCE, candidates, 6, { now: NOW });
    expect(results).toHaveLength(6);
  });
});
