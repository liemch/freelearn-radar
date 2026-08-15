/**
 * Verification 02 — search runtime paths against a real Postgres.
 *
 * Exercises the actual repository SQL (unaccent + pg_trgm), the actual truth
 * filter, the actual hybrid/semantic fusion, and the actual analytics write —
 * not stand-ins. Every assertion here would have been unverifiable in the
 * previous static review.
 */

import "@/lib/load-env";

import { desc } from "drizzle-orm";

import { searchQueries } from "@/db/schema";
import { queryCatalog, searchCourses } from "@/db/repositories/course-repository";
import { recordSearchQuery } from "@/db/repositories/search-query-repository";
import { buildCatalogQuery } from "@/domain/course/catalog-query";
import { searchHybrid } from "@/domain/search/hybrid";
import { searchSemantic, readRelevanceFloor } from "@/domain/search/semantic";
import {
  enqueueCourseEmbedding,
  runEmbeddingBatch,
} from "@/domain/embedding/embed-batch";
import { FakeEmbeddingProvider } from "@/services/embedding/embedding-provider";
import { resetServerEnvCache } from "@/lib/env";

import { CheckRun, createHarness } from "./pg-harness";
import { courseBySlug, seedFixtures } from "./fixtures";

function filtersFor(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return buildCatalogQuery(search);
}

async function main(): Promise<number> {
  const run = new CheckRun();
  const h = await createHarness();
  const ids = await seedFixtures(h.db);

  const titles = (items: Array<{ title: string }>) => items.map((i) => i.title);
  const slugs = (items: Array<{ slug: string }>) => items.map((i) => i.slug);

  run.section("Keyword search (real lexical SQL)");
  {
    const result = await queryCatalog(h.db, filtersFor({ q: "python" }));
    run.expect(
      "keyword 'python' returns eligible python courses",
      result.items.length > 0,
      `${result.items.length} results: ${slugs(result.items).join(", ")}`,
    );
    run.expect(
      "PAID course excluded from keyword results",
      !slugs(result.items).includes("advanced-python-masterclass"),
    );
    run.expect(
      "FREE_TRIAL course excluded from keyword results",
      !slugs(result.items).includes("python-bootcamp-trial"),
    );
    run.expect(
      "FREE_PREVIEW course excluded from keyword results",
      !slugs(result.items).includes("python-preview-only"),
    );
    run.expect(
      "unpublished DRAFT course excluded from keyword results",
      !slugs(result.items).includes("draft-course-not-live"),
    );
  }

  run.section("Vietnamese search with diacritics");
  {
    const result = await queryCatalog(h.db, filtersFor({ q: "khóa học python" }));
    run.expect(
      "accented VI query matches the Vietnamese course",
      slugs(result.items).includes("python-cho-nguoi-moi"),
      slugs(result.items).join(", "),
    );
  }

  run.section("Vietnamese search WITHOUT diacritics (M20.1 unaccent)");
  {
    const result = await queryCatalog(h.db, filtersFor({ q: "khoa hoc python" }));
    run.expect(
      "unaccented VI query matches the accented course title",
      slugs(result.items).includes("python-cho-nguoi-moi"),
      slugs(result.items).join(", "),
    );

    const excel = await queryCatalog(h.db, filtersFor({ q: "excel co ban" }));
    run.expect(
      "unaccented 'excel co ban' matches 'Excel cơ bản miễn phí'",
      slugs(excel.items).includes("excel-co-ban-mien-phi"),
      slugs(excel.items).join(", "),
    );
  }

  run.section("Typo tolerance (pg_trgm word_similarity)");
  {
    const result = await queryCatalog(h.db, filtersFor({ q: "pyton" }));
    run.expect(
      "single-character typo still retrieves python courses",
      result.items.length > 0,
      `${result.items.length} results: ${slugs(result.items).join(", ")}`,
    );

    const viTypo = await queryCatalog(h.db, filtersFor({ q: "khoa hoc pyton" }));
    run.expect(
      "typo inside an unaccented VI query still matches",
      viTypo.items.length > 0,
      `${viTypo.items.length} results`,
    );

    // The typo branch must not become a wildcard: unrelated words stay unrelated.
    const unrelated = await queryCatalog(
      h.db,
      filtersFor({ q: "cooking recipes" }),
    );
    run.expect(
      "typo tolerance does not turn unrelated queries into matches",
      unrelated.items.length === 0,
      `${unrelated.items.length} results: ${slugs(unrelated.items).join(", ")}`,
    );

    const exactShort = await queryCatalog(h.db, filtersFor({ q: "excel" }));
    run.expect(
      "a short exact word matches a longer title (was below the old floor)",
      slugs(exactShort.items).includes("excel-co-ban-mien-phi"),
      slugs(exactShort.items).join(", "),
    );
  }

  run.section("Provider alias resolution (§87.2)");
  {
    const result = await queryCatalog(h.db, filtersFor({ q: "ms learn" }));
    run.expect(
      "'ms learn' resolves to Microsoft Learn courses",
      result.items.some((c) => c.provider.slug === "microsoft-learn"),
      slugs(result.items).join(", ") || "none",
    );
  }

  run.section("Exact-title search");
  {
    const result = await queryCatalog(
      h.db,
      filtersFor({ q: "CS50's Introduction to Programming with Python" }),
    );
    run.expect(
      "exact title returns the intended course first",
      result.items[0]?.slug === "cs50-introduction-to-programming-with-python",
      `first=${result.items[0]?.slug ?? "none"}`,
    );

    const official = await queryCatalog(h.db, filtersFor({ q: "AI for Beginners" }));
    run.expect(
      "official English title is preserved and matchable",
      titles(official.items).includes("AI for Beginners"),
    );
  }

  run.section("Vietnamese query → international (English) course");
  {
    // §116.6 / §96.1: a Vietnamese user must reach English-language courses.
    // Trigram operators score 0.000 for "quan ly du an" against "Project
    // Management Fundamentals", so this only works via concept aliases.
    for (const query of ["quan ly du an", "quản lý dự án"]) {
      const result = await queryCatalog(h.db, filtersFor({ q: query }));
      run.expect(
        `VI '${query}' reaches the English Project Management course`,
        slugs(result.items).includes("project-management-fundamentals"),
        slugs(result.items).join(", ") || "none",
      );
    }

    for (const query of ["trí tuệ nhân tạo", "tri tue nhan tao"]) {
      const result = await queryCatalog(h.db, filtersFor({ q: query }));
      run.expect(
        `VI '${query}' reaches the English AI course`,
        slugs(result.items).includes("ai-for-beginners"),
        slugs(result.items).join(", ") || "none",
      );
    }

    const design = await queryCatalog(
      h.db,
      filtersFor({ q: "thiết kế đồ họa" }),
    );
    run.expect(
      "VI 'thiết kế đồ họa' reaches the English graphic design course",
      slugs(design.items).includes("graphic-design-with-canva"),
      slugs(design.items).join(", ") || "none",
    );

    run.expect(
      "official English titles are never rewritten by aliasing",
      (await courseBySlug(h.db, "project-management-fundamentals"))?.title ===
        "Project Management Fundamentals",
    );
  }

  run.section("Filters");
  {
    const beginner = await queryCatalog(h.db, filtersFor({ level: "BEGINNER" }));
    run.expect(
      "level filter returns only BEGINNER",
      beginner.items.every((c) => c.level === "BEGINNER"),
      `levels=${[...new Set(beginner.items.map((c) => c.level))].join(",")}`,
    );

    const vietnamese = await queryCatalog(
      h.db,
      filtersFor({ language: "Vietnamese" }),
    );
    run.expect(
      "language filter returns only Vietnamese-language courses",
      vietnamese.items.length > 0 &&
        vietnamese.items.every((c) => c.language === "Vietnamese"),
      `${vietnamese.items.length} results`,
    );

    const freeCert = await queryCatalog(
      h.db,
      filtersFor({ certificate: "FREE_CERTIFICATE" }),
    );
    run.expect(
      "certificate filter returns only FREE_CERTIFICATE",
      freeCert.items.length > 0 &&
        freeCert.items.every((c) => c.certificateType === "FREE_CERTIFICATE"),
      `${freeCert.items.length} results`,
    );

    const short = await queryCatalog(h.db, filtersFor({ durationMax: "120" }));
    run.expect(
      "durationMax filter respects the max minutes",
      short.items.length > 0 &&
        short.items.every((c) => (c.durationMinutes ?? 0) <= 120),
      `durations=${short.items.map((c) => c.durationMinutes).join(",")}`,
    );

    const provider = await queryCatalog(h.db, filtersFor({ provider: "udemy" }));
    run.expect(
      "provider filter returns only that provider",
      provider.items.length > 0 &&
        provider.items.every((c) => c.provider.slug === "udemy"),
      `${provider.items.length} results`,
    );
  }

  run.section("Truth filter cannot be bypassed by an explicit filter");
  {
    // §66.4 admits no exception. An ineligible ?price= value is dropped at parse
    // time (`PRICES` is filtered by isEligibleForFreeLists), so the page falls
    // back to the whole eligible catalog. The invariant to assert is therefore
    // "no ineligible course appears", not "the page is empty".
    for (const price of ["FREE_TRIAL", "PAID", "FREE_PREVIEW"]) {
      const result = await queryCatalog(h.db, filtersFor({ price }));
      const leaked = result.items.filter((c) => c.priceType === price);
      run.expect(
        `?price=${price} surfaces no ${price} course`,
        leaked.length === 0,
        `${result.items.length} eligible results, ${leaked.length} leaked`,
      );
    }

    const allowed = await queryCatalog(h.db, filtersFor({ price: "FREE_FULL" }));
    run.expect(
      "?price=FREE_FULL is honoured (eligible values still filter)",
      allowed.items.length > 0 &&
        allowed.items.every((c) => c.priceType === "FREE_FULL"),
      `${allowed.items.length} results`,
    );
  }

  run.section("Sorting");
  {
    const shortest = await queryCatalog(h.db, filtersFor({ sort: "shortest" }));
    const durations = shortest.items.map((c) => c.durationMinutes ?? 0);
    const ascending = durations.every(
      (d, i) => i === 0 || durations[i - 1]! <= d,
    );
    run.expect("sort=shortest orders by duration ascending", ascending, durations.join(","));

    const newest = await queryCatalog(h.db, filtersFor({ sort: "newest" }));
    run.expect("sort=newest returns results", newest.items.length > 0);
  }

  run.section("Pagination");
  {
    const page1 = await queryCatalog(
      h.db,
      { ...filtersFor({}), page: 1, pageSize: 3 },
    );
    const page2 = await queryCatalog(
      h.db,
      { ...filtersFor({}), page: 2, pageSize: 3 },
    );
    run.expect("page 1 returns pageSize items", page1.items.length === 3);
    run.expect("page 2 returns a different set", 
      page2.items.length > 0 &&
        !page2.items.some((c) => slugs(page1.items).includes(c.slug)),
      `p1=${slugs(page1.items).join(",")} p2=${slugs(page2.items).join(",")}`,
    );
    run.expect(
      "totalPages is consistent with total and pageSize",
      page1.totalPages === Math.ceil(page1.total / 3),
      `total=${page1.total} totalPages=${page1.totalPages}`,
    );
  }

  run.section("Honest empty result");
  {
    const none = await queryCatalog(
      h.db,
      filtersFor({ q: "khóa học kế toán thuế Việt Nam nâng cao" }),
    );
    run.expect(
      "a query the catalog cannot answer returns zero results, not weak filler",
      none.items.length === 0,
      `${none.items.length} results`,
    );
  }

  run.section("searchCourses (standalone entry point) applies the same truth filter");
  {
    const results = await searchCourses(h.db, "python", 20);
    run.expect(
      "searchCourses excludes PAID / FREE_TRIAL / FREE_PREVIEW",
      results.every(
        (c) =>
          !["PAID", "FREE_TRIAL", "FREE_PREVIEW"].includes(c.priceType),
      ),
      results.map((c) => `${c.slug}:${c.priceType}`).join(", "),
    );
  }

  run.section("Hybrid search with flags OFF (default deploy state)");
  {
    process.env.FEATURE_HYBRID_SEARCH = "";
    process.env.FEATURE_SEMANTIC_SEARCH = "";
    process.env.RELEVANCE_FLOOR = "";
    resetServerEnvCache();

    const result = await searchHybrid(h.db, filtersFor({ q: "python" }));
    run.expect("flags OFF → retrievalMode LEXICAL", result.retrievalMode === "LEXICAL");
    run.expect("flags OFF → not marked degraded", result.degraded === false);
    run.expect("flags OFF → still returns results", result.pageIds.length > 0);
  }

  run.section("Semantic flag ON but RELEVANCE_FLOOR unset (PASS2-2 gate)");
  {
    process.env.FEATURE_HYBRID_SEARCH = "true";
    process.env.FEATURE_SEMANTIC_SEARCH = "true";
    process.env.RELEVANCE_FLOOR = "";
    process.env.EMBEDDING_PROVIDER = "fake";
    resetServerEnvCache();

    const result = await searchHybrid(h.db, filtersFor({ q: "python" }));
    run.expect(
      "uncalibrated floor keeps retrieval lexical",
      result.retrievalMode === "LEXICAL",
      `mode=${result.retrievalMode}`,
    );
    run.expect(
      "uncalibrated floor is reported as degraded",
      result.degraded === true,
    );
    run.expect(
      "search still returns usable results while degraded",
      result.pageIds.length > 0,
    );
  }

  run.section("Embedding generation + persistence (M20.2)");
  {
    process.env.EMBEDDING_PROVIDER = "fake";
    process.env.EMBEDDING_MODEL = "fake-embed-v1";
    process.env.EMBEDDING_VERSION = "v1";
    process.env.EMBEDDING_DIMENSION = "1024";
    resetServerEnvCache();

    const provider = new FakeEmbeddingProvider({
      model: "fake-embed-v1",
      dimension: 1024,
    });

    for (const key of Object.keys(ids.courseIds)) {
      await enqueueCourseEmbedding(h.db, ids.courseIds[key]!);
    }

    const first = await runEmbeddingBatch(h.db, { provider, limit: 50 });
    const stored = await h.sql(
      "select count(*)::int as n from course_embeddings where status='OK'",
    );
    run.expect(
      "embeddings persist with status OK",
      (stored[0]?.n as number) > 0,
      `rows=${String(stored[0]?.n)} batch=${JSON.stringify(first)}`,
    );
    run.expect(
      "api_usage_log records every embedding call (§77 rule 31)",
      ((await h.sql(
        "select count(*)::int as n from api_usage_log where provider ilike '%embed%' or operation ilike '%embed%'",
      ))[0]?.n as number) > 0,
      `usage rows=${String(
        (
          await h.sql("select count(*)::int as n from api_usage_log")
        )[0]?.n,
      )}`,
    );

    const modelRows = await h.sql(
      "select distinct embedding_model, embedding_version from course_embeddings",
    );
    run.expect(
      "embeddings are stamped with model and version",
      modelRows.length === 1 &&
        modelRows[0]!.embedding_model === "fake-embed-v1" &&
        modelRows[0]!.embedding_version === "v1",
      JSON.stringify(modelRows),
    );

    const second = await runEmbeddingBatch(h.db, { provider, limit: 50 });
    run.expect(
      "unchanged courses are skipped on a second run (idempotent backfill)",
      (second.embedded ?? 0) === 0,
      JSON.stringify(second),
    );

    // §88.4: a changed course must be re-embedded, an unchanged one must not.
    await h.sql(
      "update courses set title = title || ' (updated)' where slug = 'ai-for-beginners'",
    );
    await enqueueCourseEmbedding(h.db, ids.courseIds["ai-beginners"]!);
    const third = await runEmbeddingBatch(h.db, { provider, limit: 50 });
    run.expect(
      "a changed course is re-embedded",
      (third.embedded ?? 0) === 1,
      JSON.stringify(third),
    );
  }

  run.section("Semantic retrieval with a calibrated floor");
  {
    process.env.RELEVANCE_FLOOR = "0.05";
    resetServerEnvCache();

    const floor = readRelevanceFloor("0.05");
    run.expect("floor parses as calibrated", floor.calibrated === true);

    const provider = new FakeEmbeddingProvider({
      model: "fake-embed-v1",
      dimension: 1024,
    });
    const semantic = await searchSemantic(h.db, "python for beginners", {
      provider,
      topK: 20,
      floor,
    });
    run.expect(
      "semantic retrieval runs and is not degraded",
      semantic.degraded === false,
      `hits=${semantic.hits.length}`,
    );
    run.expect(
      "every semantic hit is above the configured floor",
      semantic.hits.every((hit) => hit.score >= 0.05),
      `min=${Math.min(...semantic.hits.map((h2) => h2.score)).toFixed(4)}`,
    );

    const cached = await h.sql(
      "select count(*)::int as n from query_embedding_cache",
    );
    run.expect(
      "query embedding is cached for reuse (§89.3)",
      (cached[0]?.n as number) === 1,
      `rows=${String(cached[0]?.n)}`,
    );

    const again = await searchSemantic(h.db, "python for beginners", {
      provider,
      topK: 20,
      floor,
    });
    run.expect("second identical query is a cache hit", again.cacheHit === true);

    const hitCount = await h.sql(
      "select hit_count from query_embedding_cache limit 1",
    );
    run.expect(
      "cache hit_count increments in the database",
      Number(hitCount[0]?.hit_count) >= 1,
      `hit_count=${String(hitCount[0]?.hit_count)}`,
    );
  }

  run.section("Semantic retrieval cannot bypass Truth");
  {
    const provider = new FakeEmbeddingProvider({
      model: "fake-embed-v1",
      dimension: 1024,
    });
    // The PAID course has the highest qualityScore in the fixture set and is a
    // near-title match for this query; it must still never appear.
    const semantic = await searchSemantic(h.db, "Advanced Python Masterclass", {
      provider,
      topK: 50,
      floor: { calibrated: true, minCosine: 0 },
    });
    run.expect(
      "PAID course never appears in semantic hits",
      !semantic.hits.some((hit) => hit.courseId === ids.courseIds.paidPython) &&
        !semantic.hits.some(
          (hit) => hit.courseId === ids.courseIds["paid-python"],
        ),
      `hits=${semantic.hits.length}`,
    );
    run.expect(
      "FREE_TRIAL course never appears in semantic hits",
      !semantic.hits.some(
        (hit) => hit.courseId === ids.courseIds["trial-python"],
      ),
    );
    run.expect(
      "FREE_PREVIEW course never appears in semantic hits",
      !semantic.hits.some(
        (hit) => hit.courseId === ids.courseIds["preview-python"],
      ),
    );
    run.expect(
      "unpublished course never appears in semantic hits",
      !semantic.hits.some(
        (hit) => hit.courseId === ids.courseIds["unpublished"],
      ),
    );
  }

  run.section("Hybrid search with semantic enabled and calibrated");
  {
    process.env.FEATURE_HYBRID_SEARCH = "true";
    process.env.FEATURE_SEMANTIC_SEARCH = "true";
    process.env.RELEVANCE_FLOOR = "0.05";
    process.env.EMBEDDING_PROVIDER = "fake";
    process.env.EMBEDDING_MODEL = "fake-embed-v1";
    process.env.EMBEDDING_DIMENSION = "1024";
    resetServerEnvCache();

    const result = await searchHybrid(h.db, filtersFor({ q: "python" }));
    run.expect(
      "hybrid mode is reached when flags and floor are both set",
      result.retrievalMode === "HYBRID" || result.retrievalMode === "SEMANTIC",
      `mode=${result.retrievalMode} degraded=${result.degraded}`,
    );
    run.expect(
      "hybrid returns a page slice",
      result.pageIds.length > 0,
      `pageIds=${result.pageIds.length} courseIds=${result.courseIds.length}`,
    );
    run.expect(
      "ineligible courses are absent from the fused id set",
      !result.courseIds.includes(ids.courseIds["paid-python"]!) &&
        !result.courseIds.includes(ids.courseIds["trial-python"]!) &&
        !result.courseIds.includes(ids.courseIds["preview-python"]!),
    );

    run.section("Hybrid pagination (PASS2-1 regression)");
    const p1 = await searchHybrid(h.db, {
      ...filtersFor({ q: "python" }),
      page: 1,
      pageSize: 2,
    });
    const p2 = await searchHybrid(h.db, {
      ...filtersFor({ q: "python" }),
      page: 2,
      pageSize: 2,
    });
    run.expect(
      "page 2 differs from page 1",
      p2.pageIds.length === 0 ||
        !p2.pageIds.some((id) => p1.pageIds.includes(id)),
      `p1=${p1.pageIds.join(",")} p2=${p2.pageIds.join(",")}`,
    );
    run.expect(
      "courseIds carries the full ranked set, not one page",
      p1.courseIds.length >= p1.pageIds.length,
      `full=${p1.courseIds.length} page=${p1.pageIds.length}`,
    );
  }

  run.section("Embedding provider unavailable → safe fallback");
  {
    process.env.EMBEDDING_PROVIDER = "nvidia";
    process.env.NVIDIA_API_KEY = "";
    resetServerEnvCache();

    const semantic = await searchSemantic(h.db, "python", { topK: 10 });
    run.expect(
      "missing embedding credentials degrade rather than throw",
      semantic.degraded === true && semantic.hits.length === 0,
    );

    const hybrid = await searchHybrid(h.db, filtersFor({ q: "python" }));
    run.expect(
      "hybrid falls back to lexical when the provider is unavailable",
      hybrid.retrievalMode === "LEXICAL" && hybrid.pageIds.length > 0,
      `mode=${hybrid.retrievalMode}`,
    );
    run.expect("fallback is recorded as degraded", hybrid.degraded === true);
  }

  run.section("Mixed embedding versions are not silently blended");
  {
    process.env.EMBEDDING_PROVIDER = "fake";
    process.env.EMBEDDING_MODEL = "fake-embed-v1";
    process.env.EMBEDDING_VERSION = "v2";
    process.env.RELEVANCE_FLOOR = "0";
    resetServerEnvCache();

    const provider = new FakeEmbeddingProvider({
      model: "fake-embed-v1",
      dimension: 1024,
    });
    const semantic = await searchSemantic(h.db, "python", {
      provider,
      topK: 20,
      floor: { calibrated: true, minCosine: 0 },
    });
    run.expect(
      "v2 query reads zero v1 vectors (no cross-version blending)",
      semantic.hits.length === 0,
      `hits=${semantic.hits.length}`,
    );
    process.env.EMBEDDING_VERSION = "v1";
    resetServerEnvCache();
  }

  run.section("search_queries analytics side effects (§89.6)");
  {
    await recordSearchQuery(h.db, {
      rawQuery: "python",
      locale: "vi",
      resultCount: 3,
      latencyMs: 42,
      filtersJson: { page: 1 },
      retrievalMode: "HYBRID",
      degraded: false,
      unmetIntent: false,
      lexicalWouldBeZero: false,
      topScore: 0.0164,
      rankingConfigVersion: "ranking-v1-2026-08-14",
    });

    await recordSearchQuery(h.db, {
      rawQuery: "khóa học kế toán thuế Việt Nam nâng cao",
      locale: "vi",
      resultCount: 0,
      latencyMs: 30,
      filtersJson: { page: 1 },
      retrievalMode: "HYBRID",
      degraded: false,
      unmetIntent: true,
      lexicalWouldBeZero: true,
      topScore: null,
      rankingConfigVersion: "ranking-v1-2026-08-14",
    });

    const rows = await h.db
      .select()
      .from(searchQueries)
      .orderBy(desc(searchQueries.createdAt));

    run.expect("search queries persist", rows.length === 2, `rows=${rows.length}`);

    const unmet = rows.find((r) => r.unmetIntent === true);
    run.expect(
      "unmet_intent is stored as true for the unanswerable query",
      Boolean(unmet),
    );
    run.expect(
      "lexical_would_be_zero is stored alongside it",
      unmet?.lexicalWouldBeZero === true,
    );
    run.expect(
      "retrieval_mode is persisted",
      rows.every((r) => r.retrievalMode === "HYBRID"),
    );
    run.expect(
      "latency_ms is persisted",
      rows.every((r) => typeof r.latencyMs === "number" && r.latencyMs! > 0),
    );
    run.expect(
      "ranking_config_version is persisted for benchmark diffing",
      rows.every((r) => r.rankingConfigVersion === "ranking-v1-2026-08-14"),
    );
    // §86.2 sanctions "normalized query + hash", and §86.2 also requires VI /
    // VI-no-diacritic language analytics — which needs the diacritics kept. So
    // the requirement is a normalized query plus a hash plus a language class,
    // not redaction. Retention is the part the plan asks for and the code lacks;
    // that is recorded as a finding rather than asserted here.
    run.expect(
      "normalized query is persisted (§86.2)",
      rows.every(
        (r) => typeof r.normalizedQuery === "string" && r.normalizedQuery,
      ),
      rows.map((r) => r.normalizedQuery).join(" | "),
    );
    run.expect(
      "normalized query is length-capped",
      rows.every((r) => (r.normalizedQuery ?? "").length <= 120),
    );
    run.expect(
      "query language is classified for VI/EN analytics (§86.2)",
      rows.every((r) => typeof r.queryLanguage === "string" && r.queryLanguage),
      rows.map((r) => r.queryLanguage).join(","),
    );
    run.expect(
      "Vietnamese query is classified as VI, not EN",
      rows.some((r) => r.queryLanguage === "VI"),
      rows.map((r) => `${r.normalizedQuery}=${r.queryLanguage}`).join(" | "),
    );
    run.expect(
      "query_hash is populated",
      rows.every((r) => typeof r.queryHash === "string" && r.queryHash.length > 0),
    );
  }

  await h.close();
  return run.summary();
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error("harness error:", error);
    process.exit(1);
  });
