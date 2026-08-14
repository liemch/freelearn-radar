import { searchRankingConfig } from "@/config/search-ranking";

export type RankedHit = {
  id: string;
  rank: number;
};

export type FusedHit = {
  id: string;
  score: number;
  reasons: string[];
  lexicalRank: number | null;
  semanticRank: number | null;
};

/**
 * Deterministic Reciprocal Rank Fusion.
 * score(d) = Σ weight / (k + rank)  with rank starting at 1.
 */
export function reciprocalRankFusion(
  lists: Array<{ hits: RankedHit[]; weight: number; reason: string }>,
  options?: { k?: number; floor?: number },
): FusedHit[] {
  const k = options?.k ?? searchRankingConfig.rrfK;
  const floor = options?.floor ?? searchRankingConfig.relevanceFloor;
  const scores = new Map<
    string,
    {
      score: number;
      reasons: Set<string>;
      lexicalRank: number | null;
      semanticRank: number | null;
    }
  >();

  for (const list of lists) {
    for (const hit of list.hits) {
      const contrib = list.weight / (k + hit.rank);
      const existing = scores.get(hit.id) ?? {
        score: 0,
        reasons: new Set<string>(),
        lexicalRank: null,
        semanticRank: null,
      };
      existing.score += contrib;
      existing.reasons.add(list.reason);
      if (list.reason === searchRankingConfig.reasonCodes.LEXICAL_MATCH) {
        existing.lexicalRank = hit.rank;
      }
      if (list.reason === searchRankingConfig.reasonCodes.SEMANTIC_MATCH) {
        existing.semanticRank = hit.rank;
      }
      scores.set(hit.id, existing);
    }
  }

  return [...scores.entries()]
    .map(([id, value]) => ({
      id,
      score: value.score,
      reasons: [...value.reasons],
      lexicalRank: value.lexicalRank,
      semanticRank: value.semanticRank,
    }))
    .filter((hit) => hit.score >= floor)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
