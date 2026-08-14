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
  /** Drop fused hits below this RRF score (0 = keep all). */
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
