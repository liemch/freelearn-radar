import { describe, expect, it } from "vitest";

import {
  buildCourseComparison,
  parseCompareIds,
  type ComparableCourse,
} from "@/domain/search/compare-courses";

function makeComparable(
  overrides: Partial<ComparableCourse> & { id: string },
): ComparableCourse {
  return {
    title: `Course ${overrides.id}`,
    providerName: "Provider",
    priceType: "FREE_FULL",
    certificateType: "FREE_CERTIFICATE",
    level: "BEGINNER",
    durationMinutes: 90,
    language: "English",
    freeDurability: "PERMANENT",
    ...overrides,
  };
}

describe("parseCompareIds", () => {
  it("parses a comma-separated list", () => {
    expect(parseCompareIds("id1,id2,id3")).toEqual(["id1", "id2", "id3"]);
  });

  it("trims, dedupes, and caps at 3", () => {
    expect(parseCompareIds(" id1 , id2,id1,id3,id4 ")).toEqual([
      "id1",
      "id2",
      "id3",
    ]);
  });

  it("handles missing or empty values", () => {
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds(null)).toEqual([]);
    expect(parseCompareIds("")).toEqual([]);
    expect(parseCompareIds(",,")).toEqual([]);
  });

  it("takes the first value of an array param", () => {
    expect(parseCompareIds(["a,b", "c"])).toEqual(["a", "b"]);
  });
});

describe("buildCourseComparison", () => {
  it("builds fact rows aligned to course order", () => {
    const comparison = buildCourseComparison([
      makeComparable({ id: "a", title: "Alpha", durationMinutes: 60 }),
      makeComparable({
        id: "b",
        title: "Beta",
        providerName: "Other",
        durationMinutes: null,
        language: null,
        freeDurability: null,
      }),
    ]);

    expect(comparison.courses.map((c) => c.id)).toEqual(["a", "b"]);
    const row = (key: string) =>
      comparison.rows.find((r) => r.key === key)?.values;
    expect(row("title")).toEqual(["Alpha", "Beta"]);
    expect(row("provider")).toEqual(["Provider", "Other"]);
    expect(row("duration")).toEqual(["60", "UNKNOWN"]);
    expect(row("language")).toEqual(["English", "UNKNOWN"]);
    expect(row("freeDurability")).toEqual(["PERMANENT", "UNKNOWN"]);
  });

  it("contains no judgment fields", () => {
    const comparison = buildCourseComparison([makeComparable({ id: "a" })]);
    const keys = comparison.rows.map((r) => r.key);
    expect(keys).toEqual([
      "title",
      "provider",
      "priceType",
      "certificateType",
      "level",
      "duration",
      "language",
      "freeDurability",
    ]);
  });

  it("drops free-list-ineligible courses", () => {
    const comparison = buildCourseComparison([
      makeComparable({ id: "paid", priceType: "PAID" }),
      makeComparable({ id: "trial", priceType: "FREE_TRIAL" }),
      makeComparable({ id: "audit", priceType: "FREE_AUDIT" }),
    ]);
    expect(comparison.courses.map((c) => c.id)).toEqual(["audit"]);
  });

  it("caps comparison at 3 courses", () => {
    const comparison = buildCourseComparison(
      ["a", "b", "c", "d"].map((id) => makeComparable({ id })),
    );
    expect(comparison.courses).toHaveLength(3);
    expect(comparison.rows[0]?.values).toHaveLength(3);
  });
});
