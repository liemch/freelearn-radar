import { describe, expect, it } from "vitest";

import {
  canRenderTopicPage,
  extractTopicSlugsFromAnalysis,
  isTopicPageIndexable,
} from "@/domain/taxonomy/topic-tags";

describe("extractTopicSlugsFromAnalysis", () => {
  const base = {
    is_course: true,
    title: "Python Basics",
    provider: "Udemy",
    language: "English",
    level: "BEGINNER" as const,
    duration_minutes: 60,
    price_type: "FREE_FULL" as const,
    certificate_type: "NO_CERTIFICATE" as const,
    skills: undefined,
    summary_vi: "Học Python",
    why_learn: "Useful",
    quality_score: 70,
    confidence: 0.9,
  };

  it("extracts unique slugified categories", () => {
    expect(
      extractTopicSlugsFromAnalysis({
        ...base,
        categories: ["Python", "Data Science", "python", "Machine Learning!"],
      }),
    ).toEqual(["python", "data-science", "machine-learning"]);
  });

  it("returns empty for invalid or missing analysis", () => {
    expect(extractTopicSlugsFromAnalysis(null)).toEqual([]);
    expect(extractTopicSlugsFromAnalysis({})).toEqual([]);
    expect(
      extractTopicSlugsFromAnalysis({
        ...base,
        categories: [],
      }),
    ).toEqual([]);
  });
});

describe("topic page gates", () => {
  it("indexes only when courseCount >= 8", () => {
    expect(isTopicPageIndexable(7)).toBe(false);
    expect(isTopicPageIndexable(8)).toBe(true);
  });

  it("renders when feature flag is on or count is indexable", () => {
    expect(canRenderTopicPage(true, 0)).toBe(true);
    expect(canRenderTopicPage(false, 8)).toBe(true);
    expect(canRenderTopicPage(false, 3)).toBe(false);
  });
});
