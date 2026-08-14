import { describe, expect, it } from "vitest";

import {
  buildSearchLogFields,
  detectSearchQueryLanguage,
  hashSearchQuery,
} from "@/domain/search/normalize-query";
import { loadSearchEvalDataset } from "@/domain/search/eval-dataset";
import { searchThresholds } from "@/config/search-thresholds";

describe("search normalize-query", () => {
  it("hashes normalized lowercase query stably", () => {
    const a = hashSearchQuery("python beginner");
    const b = hashSearchQuery("python beginner");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("detects VI diacritics and no-diacritic hints", () => {
    expect(detectSearchQueryLanguage("khóa học python")).toBe("VI");
    expect(detectSearchQueryLanguage("khoa hoc python mien phi")).toBe(
      "VI_NO_DIACRITIC",
    );
    expect(detectSearchQueryLanguage("python beginner")).toBe("EN");
  });

  it("builds privacy-safe log fields", () => {
    const fields = buildSearchLogFields("  Python Beginner  ");
    expect(fields.normalizedQuery).toBe("Python Beginner");
    expect(fields.queryHash).toBe(hashSearchQuery("python beginner"));
    expect(fields.queryLanguage).toBe("EN");
  });
});

describe("search eval dataset", () => {
  it("loads v1 scaffolding with at least 60 queries", () => {
    const dataset = loadSearchEvalDataset();
    expect(dataset.version).toBe("v1");
    expect(dataset.queries.length).toBeGreaterThanOrEqual(60);
    const groups = new Set(dataset.queries.map((q) => q.group));
    expect(groups.has("EXACT")).toBe(true);
    expect(groups.has("NEGATIVE")).toBe(true);
    expect(groups.has("KEYWORD")).toBe(true);
  });
});

describe("search thresholds", () => {
  it("exposes a versioned provisional config", () => {
    expect(searchThresholds.version.length).toBeGreaterThan(0);
    expect(searchThresholds.searchP95Ms).toBe(600);
  });
});
