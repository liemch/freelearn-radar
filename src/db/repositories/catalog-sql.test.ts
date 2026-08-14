import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { courses, providers } from "@/db/schema";
import {
  buildCatalogConditions,
  catalogOrderBy,
  sortExpression,
} from "@/db/repositories/course-repository";
import { buildCatalogQuery } from "@/domain/course/catalog-query";

/**
 * Generates the real catalog SQL without executing it. `postgres()` does not open a
 * connection until a query runs, so `.toSQL()` is safe with no database available.
 */
const db = drizzle(
  postgres("postgresql://user:pass@localhost:5432/never_connected", {
    max: 1,
  }),
  { schema },
);

function catalogSql(
  filters: Parameters<typeof buildCatalogConditions>[0],
  sort?: Parameters<typeof sortExpression>[0],
) {
  const conditions = buildCatalogConditions(filters);
  return db
    .select({ course: courses, provider: providers })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(...sortExpression(sort))
    .toSQL();
}

describe("catalog ordering", () => {
  // P2-02 regression: Postgres defaults DESC to NULLS FIRST, which floated unscored
  // courses above every ranked course on category/search/provider pages.
  it.each(["recommended", "newest", "popular"] as const)(
    "orders %s with NULLS LAST",
    (sort) => {
      const { sql } = catalogSql({}, sort);
      const orderBy = sql.slice(sql.indexOf("order by"));

      expect(orderBy.toLowerCase()).toContain("desc nulls last");
      expect(orderBy.toLowerCase()).not.toContain("desc nulls first");
    },
  );

  it("orders shortest ascending with NULLS LAST", () => {
    const { sql } = catalogSql({}, "shortest");
    expect(sql.toLowerCase()).toContain("asc nulls last");
  });

  it("applies a deterministic tiebreaker to recommended", () => {
    const { sql } = catalogSql({}, "recommended");
    const orderBy = sql.slice(sql.indexOf("order by"));

    expect(orderBy).toContain("quality_score");
    expect(orderBy).toContain("last_verified_at");
    expect(orderBy).toContain("published_at");
  });
});

describe("catalog search", () => {
  // M20.1: unaccent + categories + topic tags + trigram similarity.
  it("uses immutable_unaccent and searches categories and topic tags", () => {
    const { sql, params } = catalogSql({ q: "cybersecurity" });
    const lower = sql.toLowerCase();

    expect(lower).toContain("immutable_unaccent");
    expect(lower).toContain("course_categories");
    expect(lower).toContain("course_topic_tags");
    expect(lower).toContain("similarity");
    expect(lower).toContain("exists");
    expect(params).toContain("%cybersecurity%");
  });

  it("escapes LIKE wildcards so a bare % does not match everything", () => {
    const { params } = catalogSql({ q: "100%" });
    expect(params).toContain("%100\\%%");
  });

  it("orders by lexical rank before quality when q is present", () => {
    const conditions = buildCatalogConditions({ q: "python" });
    const { sql } = db
      .select({ course: courses, provider: providers })
      .from(courses)
      .innerJoin(providers, eq(courses.providerId, providers.id))
      .where(and(...conditions))
      .orderBy(...catalogOrderBy({ q: "python", sort: "recommended" }))
      .toSQL();

    const orderBy = sql.slice(sql.indexOf("order by")).toLowerCase();
    expect(orderBy).toContain("similarity");
    expect(orderBy.indexOf("similarity")).toBeLessThan(
      orderBy.indexOf("quality_score"),
    );
  });

  it("keeps the published-only guard on every catalog query", () => {
    const { sql } = catalogSql({ q: "python" });
    expect(sql.toLowerCase()).toContain('"status"');
  });

  it("excludes FREE_TRIAL and PAID from default free catalog SQL", () => {
    const { sql, params } = catalogSql({});
    const lower = sql.toLowerCase();
    expect(lower).toContain("price_type");
    expect(lower).toMatch(/not in/i);
    expect(params).toEqual(expect.arrayContaining(["FREE_TRIAL", "PAID"]));
  });

  // Regression: the exclusion used to be an `else if`, so any explicit ?price=
  // disabled it and /free-courses/ai?price=FREE_TRIAL listed trials as free (§66.4).
  it("keeps the free-list exclusion even when priceType is explicit", () => {
    const { sql, params } = catalogSql({ priceType: "FREE_TRIAL" });
    expect(sql.toLowerCase()).toMatch(/not in/i);
    expect(params).toEqual(expect.arrayContaining(["FREE_TRIAL", "PAID"]));
  });

  it("still narrows to an allowed explicit priceType", () => {
    const { sql, params } = catalogSql({ priceType: "FREE_AUDIT" });
    expect(params).toContain("FREE_AUDIT");
    expect(sql.toLowerCase()).toMatch(/not in/i);
  });

  it("drops the free-list exclusion for admin (publishedOnly: false)", () => {
    const conditions = buildCatalogConditions(
      { priceType: "PAID" },
      { publishedOnly: false },
    );
    const { sql } = db
      .select({ course: courses })
      .from(courses)
      .where(and(...conditions))
      .toSQL();

    expect(sql.toLowerCase()).not.toMatch(/not in/i);
  });
});

describe("public price filter parsing", () => {
  it.each(["FREE_TRIAL", "PAID"])("ignores ?price=%s", (price) => {
    const filters = buildCatalogQuery(new URLSearchParams({ price }));
    expect(filters.priceType).toBeUndefined();
  });

  it("accepts a genuinely free price filter", () => {
    const filters = buildCatalogQuery(
      new URLSearchParams({ price: "FREE_AUDIT" }),
    );
    expect(filters.priceType).toBe("FREE_AUDIT");
  });
});
