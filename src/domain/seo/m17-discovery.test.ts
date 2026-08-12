import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbJsonLd,
  buildCourseJsonLd,
  buildItemListJsonLd,
  buildProviderJsonLd,
} from "@/domain/seo/json-ld";
import { selectMonthlyCollection } from "@/domain/discovery/monthly-collection";
import { selectRelatedCourses } from "@/domain/discovery/related-courses";
import { findTopicLanding, listTopicSlugs } from "@/domain/discovery/topic-landings";
import { durationBucketFromSlug } from "@/domain/course/catalog-query";
import type { Course } from "@/db/schema";

describe("JSON-LD builders", () => {
  it("builds course schema without fabricated ratings", () => {
    const json = buildCourseJsonLd({
      course: {
        title: "Python",
        slug: "python",
        shortDescription: "Learn Python",
        description: null,
        language: "English",
        instructor: "Ada",
        canonicalUrl: "https://example.com/python",
      },
      providerName: "Coursera",
      appUrl: "https://freelearn.example",
    });

    expect(json["@type"]).toBe("Course");
    expect(json).not.toHaveProperty("aggregateRating");
    expect(json).not.toHaveProperty("offers");
    expect(JSON.stringify(json)).toContain("Ada");
  });

  it("builds breadcrumbs and item lists", () => {
    expect(
      buildBreadcrumbJsonLd([
        { name: "Home", url: "https://x/" },
        { name: "AI", url: "https://x/ai" },
      ]).itemListElement,
    ).toHaveLength(2);

    const list = buildItemListJsonLd({
      name: "AI",
      description: "d",
      url: "https://x/free-courses/ai",
      courses: [{ title: "A", slug: "a" }],
      appUrl: "https://x",
    });
    expect(list["@type"]).toBe("ItemList");
  });

  it("builds provider organization schema from factual fields", () => {
    const json = buildProviderJsonLd({
      provider: { name: "Coursera", slug: "coursera", domain: "coursera.org" },
      appUrl: "https://x",
    });
    expect(json["@type"]).toBe("Organization");
    expect(json.sameAs).toBe("https://coursera.org");
  });
});

describe("topic & collection routes helpers", () => {
  it("exposes curated topic slugs", () => {
    expect(listTopicSlugs()).toContain("ai");
    expect(findTopicLanding("missing")).toBeNull();
  });

  it("maps duration collection slugs", () => {
    expect(durationBucketFromSlug("under-1-hour")).toBe("under_1h");
    expect(durationBucketFromSlug("nope")).toBeNull();
  });
});

describe("monthly collection", () => {
  it("prefers in-month courses when present", () => {
    const result = selectMonthlyCollection(
      [
        {
          id: "1",
          publishedAt: new Date("2026-08-05"),
          qualityScore: 50,
          editorScore: 50,
          priceType: "FREE_FULL",
          ratingCount: 10,
          lastVerifiedAt: new Date("2026-08-05"),
          title: "A",
          canonicalUrl: "https://a",
          certificateType: "UNKNOWN",
          language: "en",
          level: "BEGINNER",
          durationMinutes: 60,
          description: "d",
          shortDescription: "d",
          instructor: null,
        },
        {
          id: "2",
          publishedAt: new Date("2026-01-05"),
          qualityScore: 99,
          editorScore: 99,
          priceType: "FREE_FULL",
          ratingCount: 1000,
          lastVerifiedAt: new Date("2026-01-05"),
          title: "B",
          canonicalUrl: "https://b",
          certificateType: "FREE_CERTIFICATE",
          language: "en",
          level: "BEGINNER",
          durationMinutes: 60,
          description: "d",
          shortDescription: "d",
          instructor: null,
        },
      ] as unknown as Course[],
      2026,
      8,
      10,
      new Date("2026-08-13"),
    );

    expect(result.mode).toBe("in_month");
    expect(result.items[0]?.id).toBe("1");
  });
});

describe("related courses", () => {
  it("ranks by shared category and excludes self", () => {
    const related = selectRelatedCourses(
      {
        id: "src",
        providerId: "p1",
        level: "BEGINNER",
        language: "en",
        priceType: "FREE_FULL",
        categoryIds: ["c1"],
      },
      [
        {
          id: "src",
          providerId: "p1",
          level: "BEGINNER",
          language: "en",
          priceType: "FREE_FULL",
          status: "PUBLISHED",
          qualityScore: 90,
          categoryIds: ["c1"],
          provider: { name: "X" },
        },
        {
          id: "a",
          providerId: "p1",
          level: "BEGINNER",
          language: "en",
          priceType: "FREE_FULL",
          status: "PUBLISHED",
          qualityScore: 80,
          categoryIds: ["c1"],
          lastVerifiedAt: new Date(),
          title: "A",
          canonicalUrl: "https://a",
          certificateType: "FREE_CERTIFICATE",
          durationMinutes: 60,
          description: "d",
          shortDescription: "d",
          instructor: null,
          provider: { name: "X" },
        },
        {
          id: "b",
          providerId: "p2",
          level: "ADVANCED",
          language: "fr",
          priceType: "PAID",
          status: "EXPIRED",
          qualityScore: 99,
          categoryIds: ["c1"],
          provider: { name: "Y" },
        },
      ] as never,
      4,
    );

    expect(related.map((c) => c.id)).toEqual(["a"]);
  });
});
