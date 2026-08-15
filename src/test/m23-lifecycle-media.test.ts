import { describe, expect, it } from "vitest";

import { getCourseVisual } from "@/domain/course/course-visual";
import { canTransitionCourseStatus } from "@/domain/course/transitions";
import { classifyPurge } from "@/domain/course/lifecycle";

describe("M23 course media presentation", () => {
  it("prefers Admin override over resolved/source images", () => {
    const visual = getCourseVisual({
      id: "1",
      slug: "override",
      title: "Override course",
      imageOverrideUrl: "/api/course-media/abc?v=1",
      imageResolvedUrl: "https://cdn.example.com/resolved.jpg",
      imageStorageUrl: "https://cdn.example.com/stored.jpg",
      imageSourceUrl: "https://cdn.example.com/source.jpg",
      provider: { name: "Coursera", slug: "coursera" },
    } as never);
    expect(visual.src).toBe("/api/course-media/abc?v=1");
  });

  it("falls back to branded tile when no displayable image exists", () => {
    const visual = getCourseVisual({
      id: "2",
      slug: "missing",
      title: "Missing image",
      imageOverrideUrl: null,
      imageResolvedUrl: null,
      imageStorageUrl: null,
      imageSourceUrl: null,
      provider: { name: "edX", slug: "edx" },
    } as never);
    expect(visual.src).toBeNull();
    expect(visual.toneClass).toMatch(/^course-tile-/);
  });
});

describe("M23 course lifecycle rules", () => {
  it("restores only ARCHIVED → DRAFT", () => {
    expect(canTransitionCourseStatus("ARCHIVED", "DRAFT")).toBe(true);
    expect(canTransitionCourseStatus("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransitionCourseStatus("PUBLISHED", "ARCHIVED")).toBe(true);
  });

  it("blocks purge when history exists", () => {
    expect(
      classifyPurge({
        outboundClicks: 3,
        observations: 0,
        verifications: 0,
        offers: 0,
        watches: 0,
        embeddings: 0,
        affiliateClicks: 0,
        productContexts: 0,
        publishedAt: null,
        status: "ARCHIVED",
      }),
    ).toBe("BLOCKED_BY_HISTORY");
  });

  it("allows safe purge for unused drafts", () => {
    expect(
      classifyPurge({
        outboundClicks: 0,
        observations: 0,
        verifications: 0,
        offers: 0,
        watches: 0,
        embeddings: 0,
        affiliateClicks: 0,
        productContexts: 0,
        publishedAt: null,
        status: "ARCHIVED",
      }),
    ).toBe("SAFE_TO_PURGE");
  });

  it("requires cascade confirmation for technical dependencies", () => {
    expect(
      classifyPurge({
        outboundClicks: 0,
        observations: 2,
        verifications: 1,
        offers: 0,
        watches: 0,
        embeddings: 1,
        affiliateClicks: 0,
        productContexts: 0,
        publishedAt: null,
        status: "ARCHIVED",
      }),
    ).toBe("PURGE_WITH_SAFE_CASCADE");
  });
});
