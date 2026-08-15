/**
 * PASS 2 regression tests.
 *
 * These cover defects found by re-auditing the PASS 1 remediation itself, plus
 * one invariant PASS 1 missed. Both classes are recorded here so a later change
 * cannot quietly reopen either.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { searchRankingConfig } from "@/config/search-ranking";
import { reciprocalRankFusion } from "@/domain/search/fusion";
import { readRelevanceFloor } from "@/domain/search/semantic";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("PASS2-1 — hybrid pagination must not serve page 1 under every page", () => {
  const hybrid = read("src/domain/search/hybrid.ts");
  const page = read("src/app/[locale]/search/page.tsx");

  it("derives the page slice from filters.page", () => {
    expect(hybrid).toContain("function pageSlice");
    expect(hybrid).toContain("const page = filters.page ?? 1");
    expect(hybrid).toContain("pageIds: pageSlice(");
  });

  it("returns the full ranked set separately from the page slice", () => {
    // `courseIds` must stay complete so the page can compute a real total; the
    // PASS 1 version sliced it to pageSize and made page 2 impossible.
    expect(hybrid).toContain("courseIds: eligibleIds");
    expect(hybrid).not.toContain("courseIds: fused.slice(0, pageSize)");
    expect(hybrid).not.toContain(
      "courseIds: lexical.items.slice(0, pageSize).map((i) => i.id)",
    );
  });

  it("hydrates the page slice, not a fixed prefix", () => {
    expect(page).toContain("listEligibleCoursesByIds(db, hybrid.pageIds)");
    expect(page).not.toContain("hybrid.courseIds.slice(0, catalog.pageSize)");
  });

  it("bases the total on the full fused set", () => {
    expect(page).toContain("const total = hybrid.courseIds.length");
  });
});

describe("PASS2-2 — semantic retrieval needs a calibrated relevance floor", () => {
  it("treats an unset floor as uncalibrated rather than defaulting one", () => {
    expect(readRelevanceFloor(undefined)).toEqual({ calibrated: false });
    expect(readRelevanceFloor("")).toEqual({ calibrated: false });
    expect(readRelevanceFloor("   ")).toEqual({ calibrated: false });
  });

  it("rejects values that are not a usable cosine threshold", () => {
    for (const bad of ["abc", "-0.1", "1.5", "NaN", "Infinity"]) {
      expect(readRelevanceFloor(bad)).toEqual({ calibrated: false });
    }
  });

  it("accepts a calibrated threshold", () => {
    expect(readRelevanceFloor("0.42")).toEqual({
      calibrated: true,
      minCosine: 0.42,
    });
    expect(readRelevanceFloor("0")).toEqual({ calibrated: true, minCosine: 0 });
  });

  it("keeps the semantic path off while the floor is uncalibrated", () => {
    const hybrid = read("src/domain/search/hybrid.ts");
    expect(hybrid).toContain("const semanticOn = flagsWantSemantic && floor.calibrated");
    expect(hybrid).toContain("RELEVANCE_FLOOR_unset");
  });

  it("applies the floor inside semantic retrieval, not only at fusion", () => {
    const semantic = read("src/domain/search/semantic.ts");
    expect(semantic).toContain("if (minCosine !== null && score < minCosine) continue");
  });
});

describe("PASS2-3 — the RRF floor is a rank cutoff, not a relevance judgement", () => {
  // Documents the arithmetic so nobody mistakes `relevanceFloor` for the §89.5
  // relevance floor again. k=60, weight=1.
  const k = searchRankingConfig.rrfK;
  const floor = searchRankingConfig.relevanceFloor;

  it("keeps a rank-1 single-list hit", () => {
    expect(1 / (k + 1)).toBeCloseTo(0.016393, 6);
    expect(1 / (k + 1)).toBeGreaterThan(floor);
  });

  it("cuts single-list hits at rank 41 and keeps rank 40", () => {
    expect(1 / (k + 40)).toBeCloseTo(0.01, 6);
    expect(1 / (k + 40)).toBeGreaterThanOrEqual(floor);
    expect(1 / (k + 41)).toBeLessThan(floor);
  });

  it("always keeps a hit present in both lists, however weak", () => {
    // A document last in both 50-item lists still clears the floor, which is
    // why relevance has to be enforced on cosine instead.
    const fused = reciprocalRankFusion([
      { hits: [{ id: "weak", rank: 50 }], weight: 1, reason: "LEXICAL_MATCH" },
      { hits: [{ id: "weak", rank: 50 }], weight: 1, reason: "SEMANTIC_MATCH" },
    ]);
    expect(fused).toHaveLength(1);
    expect(fused[0]!.score).toBeGreaterThan(floor);
  });

  it("stays deterministic for tied scores", () => {
    const lists = [
      {
        hits: [
          { id: "b", rank: 1 },
          { id: "a", rank: 1 },
        ],
        weight: 1,
        reason: "LEXICAL_MATCH",
      },
    ];
    const first = reciprocalRankFusion(lists).map((h) => h.id);
    const second = reciprocalRankFusion(lists).map((h) => h.id);
    expect(first).toEqual(second);
    expect(first).toEqual(["a", "b"]);
  });
});

describe("PASS2-4 — media resolution batch size must count courses", () => {
  const runner = read("src/domain/media/media-resolution-runner.ts");

  it("does not join categories into the limited selection query", () => {
    // A leftJoin on course_categories would let one multi-category course
    // consume several rows of the batch limit.
    expect(runner).not.toContain("courseCategories");
    expect(runner).toContain("mapCourseIdsToPrimaryCategorySlug");
  });

  it("bounds the run and orders oldest-checked first", () => {
    expect(runner).toContain("MEDIA_RESOLVE_LIMIT");
    expect(runner).toContain("imageCheckedAt} ASC NULLS FIRST");
    expect(runner).toContain("MEDIA_RECHECK_HOURS");
  });

  it("isolates per-course failures so one bad image cannot fail the run", () => {
    expect(runner).toContain("summary.errors += 1");
  });
});
