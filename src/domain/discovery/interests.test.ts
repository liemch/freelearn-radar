import { describe, expect, it } from "vitest";

import {
  interestBoostScore,
  parseInterestSlugs,
  softRankByInterests,
} from "@/domain/discovery/interests";

describe("interests preference", () => {
  it("parses and caps interest slugs", () => {
    expect(parseInterestSlugs(["ai", "finance", "evil"])).toEqual([
      "ai",
      "finance",
    ]);
  });

  it("soft-ranks without removing items", () => {
    const items = [
      { id: "1", cats: ["programming"] },
      { id: "2", cats: ["soft-skills"] },
      { id: "3", cats: ["finance"] },
    ];
    const ranked = softRankByInterests(
      items,
      (i) => i.cats,
      ["soft-skills", "finance"],
    );
    expect(ranked.map((i) => i.id)).toEqual(["2", "3", "1"]);
    expect(ranked).toHaveLength(3);
  });

  it("boost is zero without interests", () => {
    expect(interestBoostScore(["ai"], [])).toBe(0);
  });
});
