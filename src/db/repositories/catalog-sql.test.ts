import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { courses, providers } from "@/db/schema";
import {
  buildCatalogConditions,
  sortExpression,
} from "@/db/repositories/course-repository";

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
  // P2-04 regression: project plan §26 lists categories as a search field.
  it("searches category names as well as course and provider text", () => {
    const { sql, params } = catalogSql({ q: "cybersecurity" });
    const lower = sql.toLowerCase();

    expect(lower).toContain("course_categories");
    expect(lower).toContain("exists");
    expect(params).toContain("%cybersecurity%");
  });

  it("escapes LIKE wildcards so a bare % does not match everything", () => {
    const { params } = catalogSql({ q: "100%" });
    expect(params).toContain("%100\\%%");
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

  it("does not apply free-list exclusion when priceType is explicit", () => {
    const { sql, params } = catalogSql({ priceType: "FREE_TRIAL" });
    expect(params).toContain("FREE_TRIAL");
    expect(sql.toLowerCase()).not.toMatch(/not in/i);
  });
});
