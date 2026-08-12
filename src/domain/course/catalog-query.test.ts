import { describe, expect, it } from "vitest";

import {
  buildCatalogQuery,
  parseCatalogSort,
  parsePositiveInt,
} from "@/domain/course/catalog-query";

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

  it("builds filters from search params", () => {
    const params = new URLSearchParams(
      "q=python&provider=coursera&level=BEGINNER&price=FREE_FULL&sort=newest&page=2",
    );

    expect(buildCatalogQuery(params)).toEqual({
      q: "python",
      providerSlug: "coursera",
      level: "BEGINNER",
      language: undefined,
      certificateType: undefined,
      priceType: "FREE_FULL",
      sort: "newest",
      page: 2,
      pageSize: 12,
    });
  });
});
