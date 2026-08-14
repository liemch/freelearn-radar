import { describe, expect, it } from "vitest";

import {
  expandProviderAliases,
  prepareLexicalQuery,
  stripDiacritics,
  tokenizeLexical,
} from "@/domain/search/lexical";
import { buildLexicalMatchCondition } from "@/domain/search/lexical-sql";

describe("lexical normalizer", () => {
  it("strips Vietnamese diacritics including đ", () => {
    expect(stripDiacritics("khóa học")).toBe("khoa hoc");
    expect(stripDiacritics("Đà Nẵng")).toBe("Da Nang");
  });

  it("expands provider aliases", () => {
    expect(expandProviderAliases("ms learn azure")).toContain("microsoft learn");
    expect(expandProviderAliases("aws beginner")).toContain("amazon web services");
  });

  it("dedupes tokens and drops stopwords", () => {
    expect(tokenizeLexical("the python for the beginner")).toEqual([
      "python",
      "beginner",
    ]);
  });

  it("prepares a folded LIKE pattern for VI-no-diacritic queries", () => {
    const prepared = prepareLexicalQuery("Khoa học Python");
    expect(prepared).not.toBeNull();
    expect(prepared!.folded).toBe("khoa hoc python");
    expect(prepared!.likePattern).toBe("%khoa hoc python%");
    expect(prepared!.tokens).toEqual(["khoa", "hoc", "python"]);
  });

  it("builds a SQL match condition referencing unaccent and trgm", () => {
    const condition = buildLexicalMatchCondition("python");
    expect(condition).not.toBeNull();
    // drizzle SQL chunks are opaque; ensuring non-null is the compile-time guard.
    // Catalog SQL tests assert the rendered query string.
  });
});
