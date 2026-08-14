import { describe, expect, it } from "vitest";

import { searchRankingConfig } from "@/config/search-ranking";
import {
  cosineSimilarity,
  reciprocalRankFusion,
} from "@/domain/search/fusion";

describe("reciprocalRankFusion", () => {
  it("scores by summed weighted reciprocal ranks", () => {
    const fused = reciprocalRankFusion(
      [
        {
          hits: [{ id: "a", rank: 1 }],
          weight: 1,
          reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
        },
        {
          hits: [{ id: "a", rank: 3 }],
          weight: 2,
          reason: searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
        },
      ],
      { k: 60, floor: 0 },
    );
    expect(fused).toHaveLength(1);
    expect(fused[0]?.score).toBeCloseTo(1 / 61 + 2 / 63, 10);
    expect(fused[0]?.lexicalRank).toBe(1);
    expect(fused[0]?.semanticRank).toBe(3);
    expect(fused[0]?.reasons).toContain(
      searchRankingConfig.reasonCodes.LEXICAL_MATCH,
    );
    expect(fused[0]?.reasons).toContain(
      searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
    );
  });

  it("breaks score ties by id for determinism", () => {
    const fused = reciprocalRankFusion(
      [
        {
          hits: [
            { id: "zzz", rank: 1 },
            { id: "aaa", rank: 1 },
          ],
          weight: 1,
          reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
        },
      ],
      { floor: 0 },
    );
    expect(fused.map((h) => h.id)).toEqual(["aaa", "zzz"]);
  });

  it("drops hits below the relevance floor", () => {
    const fused = reciprocalRankFusion(
      [
        {
          hits: [
            { id: "high", rank: 1 },
            { id: "low", rank: 1000 },
          ],
          weight: 1,
          reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
        },
      ],
      { k: 60, floor: 0.01 },
    );
    expect(fused.map((h) => h.id)).toEqual(["high"]);
  });

  it("returns empty for empty input lists", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(
      reciprocalRankFusion([
        {
          hits: [],
          weight: 1,
          reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
        },
      ]),
    ).toEqual([]);
  });
});

describe("cosineSimilarity", () => {
  it("computes similarity for known vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for empty or mismatched vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
