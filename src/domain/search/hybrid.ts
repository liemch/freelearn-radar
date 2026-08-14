import type { Db } from "@/db";
import { queryCatalog } from "@/db/repositories/course-repository";
import { searchRankingConfig } from "@/config/search-ranking";
import type { CatalogFilters } from "@/domain/course/catalog-query";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import {
  reciprocalRankFusion,
  type FusedHit,
} from "@/domain/search/fusion";
import { searchSemantic } from "@/domain/search/semantic";
import { getServerEnv } from "@/lib/env";

export type HybridSearchResult = {
  courseIds: string[];
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
  const q = filters.q?.trim() ?? "";

  const hybridOn = env.FEATURE_HYBRID_SEARCH === "true";
  const semanticOn =
    env.FEATURE_SEMANTIC_SEARCH === "true" || hybridOn;

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
    return {
      courseIds: lexical.items.slice(0, pageSize).map((i) => i.id),
      fused: lexicalHits.map((h) => ({
        id: h.id,
        score: 1 / (searchRankingConfig.rrfK + h.rank),
        reasons: [searchRankingConfig.reasonCodes.LEXICAL_MATCH],
        lexicalRank: h.rank,
        semanticRank: null,
      })),
      retrievalMode: "LEXICAL",
      degraded: false,
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
      return {
        courseIds: fused.slice(0, pageSize).map((h) => h.id),
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

    return {
      courseIds: lexical.items.slice(0, pageSize).map((i) => i.id),
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

  // Truth filter: drop ids that are not free-eligible (defense in depth).
  const eligibleIds: string[] = [];
  for (const hit of fused) {
    const item = lexical.items.find((c) => c.id === hit.id);
    if (item && !isEligibleForFreeLists(item.priceType)) continue;
    eligibleIds.push(hit.id);
    if (eligibleIds.length >= pageSize) break;
  }

  // If fusion produced ids not in the lexical page, keep them (semantic-only finds).
  if (eligibleIds.length < pageSize) {
    for (const hit of fused) {
      if (eligibleIds.includes(hit.id)) continue;
      eligibleIds.push(hit.id);
      if (eligibleIds.length >= pageSize) break;
    }
  }

  return {
    courseIds: eligibleIds,
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
