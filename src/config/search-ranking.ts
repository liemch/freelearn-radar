/**
 * Versioned search ranking / fusion config (plan §89.2, §90).
 * Bump `version` when any weight or floor changes.
 */
export const SEARCH_RANKING_CONFIG_VERSION = "ranking-v1-2026-08-14";

export const searchRankingConfig = {
  version: SEARCH_RANKING_CONFIG_VERSION,
  /** Reciprocal Rank Fusion constant k (classic = 60). */
  rrfK: 60,
  lexicalWeight: 1,
  semanticWeight: 1,
  /**
   * Minimum fused RRF score. This is a RANK cutoff, not a relevance judgement,
   * and the name is retained only because it is persisted in benchmark runs.
   *
   * With k=60 and weight=1 the arithmetic is fixed: rank 1 scores 1/61 ≈ 0.0164,
   * rank 40 scores exactly 1/100 = 0.0100, rank 41 scores ≈ 0.0099. So 0.01
   * discards single-list hits from rank 41 down, and any document appearing in
   * both lists scores ≥ 2/110 ≈ 0.0182 and always survives — however weak the
   * underlying match is.
   *
   * The actual §89.5 relevance floor is therefore enforced on cosine similarity
   * in the semantic path (`RELEVANCE_FLOOR`), because that is the only place a
   * score carries meaning about relevance rather than position.
   */
  relevanceFloor: 0.01,
  vectorTopK: 50,
  lexicalTopK: 50,
  exactTitleBoost: 2.0,
  providerMatchBoost: 1.2,
  reasonCodes: {
    EXACT_TITLE_MATCH: "EXACT_TITLE_MATCH",
    PROVIDER_MATCH: "PROVIDER_MATCH",
    SEMANTIC_MATCH: "SEMANTIC_MATCH",
    LEXICAL_MATCH: "LEXICAL_MATCH",
    QUALITY_SIGNAL: "QUALITY_SIGNAL",
    FREE_DURABILITY: "FREE_DURABILITY",
  },
} as const;

export type SearchRankingConfig = typeof searchRankingConfig;
