import { describe, expect, it } from "vitest";

import { buildSemanticDocument } from "@/domain/embedding/semantic-document";
import { FakeEmbeddingProvider } from "@/services/embedding/embedding-provider";
import { reciprocalRankFusion, cosineSimilarity } from "@/domain/search/fusion";
import { searchRankingConfig } from "@/config/search-ranking";

describe("buildSemanticDocument", () => {
  it("hashes deterministically and omits AI fields by default", () => {
    const a = buildSemanticDocument({
      title: "Azure Fundamentals",
      providerName: "Microsoft Learn",
      categoryNames: ["Cloud"],
      topicTagNames: ["azure"],
      level: "BEGINNER",
      durationMinutes: 120,
      language: "English",
      priceType: "FREE_FULL",
      certificateType: "NO_CERTIFICATE",
      freeDurability: "STABLE",
      summaryVi: "secret ai",
      whyLearn: "why",
      embedAiDerived: false,
    });
    const b = buildSemanticDocument({
      title: "Azure Fundamentals",
      providerName: "Microsoft Learn",
      categoryNames: ["Cloud"],
      topicTagNames: ["azure"],
      level: "BEGINNER",
      durationMinutes: 120,
      language: "English",
      priceType: "FREE_FULL",
      certificateType: "NO_CERTIFICATE",
      freeDurability: "STABLE",
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.text).not.toContain("secret ai");
    expect(a.usedAiDerived).toBe(false);
  });

  it("includes AI fields when flagged", () => {
    const doc = buildSemanticDocument({
      title: "X",
      providerName: "Y",
      categoryNames: [],
      topicTagNames: [],
      level: "BEGINNER",
      durationMinutes: null,
      language: null,
      priceType: "FREE_FULL",
      certificateType: "NO_CERTIFICATE",
      freeDurability: "STABLE",
      summaryVi: "Tóm tắt",
      embedAiDerived: true,
    });
    expect(doc.usedAiDerived).toBe(true);
    expect(doc.text).toContain("Tóm tắt");
  });
});

describe("FakeEmbeddingProvider", () => {
  it("returns unit vectors of the configured dimension", async () => {
    const provider = new FakeEmbeddingProvider({ dimension: 1024 });
    const result = await provider.generate(["hello", "world"]);
    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]).toHaveLength(1024);
    const norm = Math.sqrt(
      result.embeddings[0]!.reduce((s, v) => s + v * v, 0),
    );
    expect(norm).toBeCloseTo(1, 5);
  });

  it("is deterministic for the same text", async () => {
    const provider = new FakeEmbeddingProvider();
    const a = await provider.generate(["same"]);
    const b = await provider.generate(["same"]);
    expect(a.embeddings[0]).toEqual(b.embeddings[0]);
  });
});

describe("reciprocalRankFusion", () => {
  it("is deterministic and prefers consensus", () => {
    const fused = reciprocalRankFusion([
      {
        hits: [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
        weight: 1,
        reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
      },
      {
        hits: [
          { id: "b", rank: 1 },
          { id: "a", rank: 2 },
        ],
        weight: 1,
        reason: searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
      },
    ]);
    expect(fused[0]?.id).toBe("a");
    expect(fused[1]?.id).toBe("b");
    const again = reciprocalRankFusion([
      {
        hits: [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
        weight: 1,
        reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
      },
      {
        hits: [
          { id: "b", rank: 1 },
          { id: "a", rank: 2 },
        ],
        weight: 1,
        reason: searchRankingConfig.reasonCodes.SEMANTIC_MATCH,
      },
    ]);
    expect(again.map((h) => h.id)).toEqual(fused.map((h) => h.id));
  });

  it("applies relevance floor", () => {
    const fused = reciprocalRankFusion(
      [
        {
          hits: [{ id: "only", rank: 50 }],
          weight: 1,
          reason: searchRankingConfig.reasonCodes.LEXICAL_MATCH,
        },
      ],
      { floor: 0.5 },
    );
    expect(fused).toHaveLength(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });
});
