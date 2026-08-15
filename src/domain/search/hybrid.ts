import type { Db } from "@/db";
import { queryCatalog } from "@/db/repositories/course-repository";
import { searchRankingConfig } from "@/config/search-ranking";
import type { CatalogFilters } from "@/domain/course/catalog-query";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import {
  reciprocalRankFusion,
  type FusedHit,
} from "@/domain/search/fusion";
import { readRelevanceFloor, searchSemantic } from "@/domain/search/semantic";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type HybridSearchResult = {
  /** Full ordered eligible result set (bounded by top-K), not a single page. */
  courseIds: string[];
  /** The slice for `filters.page`, so pagination stays coherent. */
  pageIds: string[];
  fused: FusedHit[];
  retrievalMode: "LEXICAL" | "SEMANTIC" | "HYBRID";
  degraded: boolean;
  lexicalWouldBeZero: boolean;
  unmetIntent: boolean;
  cacheHit: boolean;
  latencyMs: number;
  topScore: number | null;
};

/**
 * `courseIds` is the whole ranked set, so the page slice is derived here rather
 * than by the caller. Slicing from 0 regardless of `page` would serve page 1's
 * results under every page number.
 */
function pageSlice(ids: string[], page: number, pageSize: number): string[] {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (safePage - 1) * pageSize;
  return ids.slice(start, start + pageSize);
}

/**
 * Hybrid retrieval: lexical + semantic → RRF → truth filter.
 * Flags control whether semantic/hybrid paths run; lexical always available.
 */
export async function searchHybrid(
  db: Db,
  filters: CatalogFilters,
  options?: { pageSize?: number },
): Promise<HybridSearchResult> {
  const env = getServerEnv();
  const started = Date.now();
  const pageSize = options?.pageSize ?? filters.pageSize ?? 12;
  const page = filters.page ?? 1;
  const q = filters.q?.trim() ?? "";

  const hybridOn = env.FEATURE_HYBRID_SEARCH === "true";
  const flagsWantSemantic =
    env.FEATURE_SEMANTIC_SEARCH === "true" || hybridOn;

  // §89.5 makes the relevance floor a precondition for semantic retrieval, not
  // a later refinement: without it, a query with no good match still returns
  // top-K by cosine and the honest empty state never happens. An uncalibrated
  // floor therefore keeps the semantic path off instead of shipping weak
  // matches, and the caller records the request as degraded.
  const floor = readRelevanceFloor(env.RELEVANCE_FLOOR);
  const semanticOn = flagsWantSemantic && floor.calibrated;

  if (flagsWantSemantic && !floor.calibrated) {
    logger.warn("search.semantic.uncalibrated", {
      status: "degraded",
      reason: "RELEVANCE_FLOOR_unset",
    });
  }

  const lexical = await queryCatalog(db, {
    ...filters,
    page: 1,
    pageSize: searchRankingConfig.lexicalTopK,
  });

  const lexicalHits = lexical.items.map((item, index) => ({
    id: item.id,
    rank: index + 1,
  }));
  const lexicalWouldBeZero = Boolean(q) && lexical.items.length === 0;

  if (!q || !semanticOn) {
    const lexicalIds = lexical.items.map((i) => i.id);
    return {
      courseIds: lexicalIds,
      pageIds: pageSlice(lexicalIds, page, pageSize),
      fused: lexicalHits.map((h) => ({
        id: h.id,
        score: 1 / (searchRankingConfig.rrfK + h.rank),
        reasons: [searchRankingConfig.reasonCodes.LEXICAL_MATCH],
        lexicalRank: h.rank,
        semanticRank: null,
      })),
      retrievalMode: "LEXICAL",
      // A query that wanted semantic retrieval and did not get it is degraded,
      // whatever the reason. Reporting false would hide it from the §85 rate.
      degraded: Boolean(q) && flagsWantSemantic && !semanticOn,
      lexicalWouldBeZero,
      unmetIntent: lexicalWouldBeZero,
      cacheHit: false,
      latencyMs: Date.now() - started,
      topScore: lexicalHits[0]
        ? 1 / (searchRankingConfig.rrfK + 1)
        : null,
    };
  }

  let semanticDegraded = false;
  let cacheHit = false;
  let semanticHits: Array<{ id: string; rank: number }> = [];

  try {
    const semantic = await Promise.race([
      searchSemantic(db, q, {
        topK: searchRankingConfig.vectorTopK,
        timeoutMs: env.EMBEDDING_QUERY_TIMEOUT_MS,
        floor,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), env.EMBEDDING_QUERY_TIMEOUT_MS),
      ),
    ]);

    if (!semantic) {
      semanticDegraded = true;
    } else {
      semanticDegraded = semantic.degraded;
      cacheHit = semantic.cacheHit;
      semanticHits = semantic.hits.map((hit, index) => ({
        id: hit.courseId,
        rank: index + 1,
      }));
    }
  } catch {
    semanticDegraded = true;
  }

  if (!hybridOn || semanticDegraded) {
    // Semantic-only when hybrid off but semantic on, else lexical fallback.
    if (env.FEATURE_SEMANTIC_SEARCH === "true" && !hybridOn && !semanticDegraded) {
      const fused = reciprocalRankFusion([
        {
          hits: semanticHits,
          weight: searchRankingConfig.semanticWeight,
          reason: searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
        },
      ]);
      const semanticIds = fused.map((h) => h.id);
      return {
        courseIds: semanticIds,
        pageIds: pageSlice(semanticIds, page, pageSize),
        fused,
        retrievalMode: "SEMANTIC",
        degraded: false,
        lexicalWouldBeZero,
        unmetIntent: fused.length === 0,
        cacheHit,
        latencyMs: Date.now() - started,
        topScore: fused[0]?.score ?? null,
      };
    }

    const fallbackIds = lexical.items.map((i) => i.id);
    return {
      courseIds: fallbackIds,
      pageIds: pageSlice(fallbackIds, page, pageSize),
      fused: lexicalHits.map((h) => ({
        id: h.id,
        score: 1 / (searchRankingConfig.rrfK + h.rank),
        reasons: [searchRankingConfig.reasonCodes.LEXICAL_MATCH],
        lexicalRank: h.rank,
        semanticRank: null,
      })),
      retrievalMode: "LEXICAL",
      degraded: semanticDegraded,
      lexicalWouldBeZero,
      unmetIntent: lexicalWouldBeZero,
      cacheHit,
      latencyMs: Date.now() - started,
      topScore: lexicalHits[0]
        ? 1 / (searchRankingConfig.rrfK + 1)
        : null,
    };
  }

  const fused = reciprocalRankFusion([
    {
      hits: lexicalHits,
      weight: searchRankingConfig.lexicalWeight,
      reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
    },
    {
      hits: semanticHits,
      weight: searchRankingConfig.semanticWeight,
      reason: searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
    },
  ]);

  // Truth filter: drop ids known to be ineligible (defense in depth — the
  // lexical and semantic queries already exclude them, and hydration filters
  // again). Ids absent from the lexical page are semantic-only finds and are
  // kept in fused order; eligibility for those is enforced at hydration.
  const priceTypeById = new Map(
    lexical.items.map((item) => [item.id, item.priceType] as const),
  );
  const eligibleIds: string[] = [];
  const seen = new Set<string>();
  for (const hit of fused) {
    if (seen.has(hit.id)) continue;
    const priceType = priceTypeById.get(hit.id);
    if (priceType && !isEligibleForFreeLists(priceType)) continue;
    seen.add(hit.id);
    eligibleIds.push(hit.id);
  }

  return {
    courseIds: eligibleIds,
    pageIds: pageSlice(eligibleIds, page, pageSize),
    fused,
    retrievalMode: "HYBRID",
    degraded: false,
    lexicalWouldBeZero,
    unmetIntent: eligibleIds.length === 0 && Boolean(q),
    cacheHit,
    latencyMs: Date.now() - started,
    topScore: fused[0]?.score ?? null,
  };
}
