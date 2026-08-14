import { describe, expect, it } from "vitest";

import {
  buildCatalogQuery,
  catalogFiltersToQuery,
  normalizeSearchQuery,
  parseCatalogSort,
  parsePositiveInt,
} from "@/domain/course/catalog-query";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";

describe("catalog query helpers", () => {
  it("parses sort values with a safe default", () => {
    expect(parseCatalogSort("newest")).toBe("newest");
    expect(parseCatalogSort("nope")).toBe("recommended");
  });

  it("parses page numbers safely", () => {
    expect(parsePositiveInt("3", 1)).toBe(3);
    expect(parsePositiveInt("0", 1)).toBe(1);
    expect(parsePositiveInt(undefined, 1)).toBe(1);
  });

  it("normalizes search queries", () => {
    expect(normalizeSearchQuery("  Python\tAI  ")).toBe("Python AI");
    expect(normalizeSearchQuery("")).toBeUndefined();
  });

  it("builds filters from search params including certificate and duration", () => {
    const params = new URLSearchParams(
      "q=python&provider=coursera&level=BEGINNER&price=FREE_FULL&certificate=FREE_CERTIFICATE&durationMax=60&sort=newest&page=2",
    );

    expect(buildCatalogQuery(params)).toEqual({
      q: "python",
      providerSlug: "coursera",
      level: "BEGINNER",
      language: undefined,
      certificateType: "FREE_CERTIFICATE",
      priceType: "FREE_FULL",
      durationMaxMinutes: 60,
      sort: "newest",
      page: 2,
      pageSize: 12,
    });
  });

  it("serializes shareable query params", () => {
    expect(
      catalogFiltersToQuery({
        q: "ai",
        certificateType: "FREE_CERTIFICATE",
        durationMaxMinutes: 60,
        sort: "recommended",
      }),
    ).toMatchObject({
      q: "ai",
      certificate: "FREE_CERTIFICATE",
      durationMax: "60",
      sort: undefined,
    });
  });

  it("never treats FREE_TRIAL as free-list eligible", () => {
    expect(isEligibleForFreeLists("FREE_TRIAL")).toBe(false);
    expect(isEligibleForFreeLists("PAID")).toBe(false);
    expect(isEligibleForFreeLists("FREE_FULL")).toBe(true);
  });
});
