import { describe, expect, it } from "vitest";

import {
  classifyCoverageCount,
  classifyProviderHealth,
  classifySearchOutcome,
  discoveryPriorityScore,
  nextRunHoursForJunkRate,
} from "@/domain/coverage/classify-coverage";
import { classifyDiscoveryFailureReason } from "@/domain/coverage/failure-reasons";
import { normalizeDemandQuery } from "@/domain/coverage/unmet-intent";
import { buildCoverageWorkQueues } from "@/domain/coverage/work-queues";
import { interleaveByCategory } from "@/domain/discovery/discovery-query-service";

describe("M26 coverage classification", () => {
  it("classifies EMPTY / THIN / HEALTHY / STRONG from published counts", () => {
    expect(classifyCoverageCount(0)).toBe("EMPTY");
    expect(classifyCoverageCount(3)).toBe("THIN");
    expect(classifyCoverageCount(10)).toBe("HEALTHY");
    expect(classifyCoverageCount(20)).toBe("STRONG");
  });

  it("prioritizes empty coverage over strong", () => {
    expect(
      discoveryPriorityScore({
        coverage: "EMPTY",
        zeroResultDemand: 0,
        recentYield: null,
      }),
    ).toBeGreaterThan(
      discoveryPriorityScore({
        coverage: "STRONG",
        zeroResultDemand: 0,
        recentYield: null,
      }),
    );
  });

  it("lengthens schedule for high junk without going unbounded", () => {
    expect(nextRunHoursForJunkRate(0.2)).toBe(24);
    expect(nextRunHoursForJunkRate(0.6)).toBe(36);
    expect(nextRunHoursForJunkRate(0.9)).toBe(48);
  });
});

describe("M26 failure reasons", () => {
  it("maps known ingest errors onto stable codes", () => {
    expect(classifyDiscoveryFailureReason("DUPLICATE:COURSE")).toBe(
      "DUPLICATE",
    );
    expect(
      classifyDiscoveryFailureReason("NON_COURSE_PATTERN: listing"),
    ).toBe("NO_COURSE_SIGNAL");
    expect(classifyDiscoveryFailureReason("Invalid external URL")).toBe(
      "INVALID_URL",
    );
    expect(
      classifyDiscoveryFailureReason("AUTO_REJECT: paid only", "REJECTED"),
    ).toBe("AUTO_REJECT");
  });
});

describe("M26 unmet intent normalization", () => {
  it("aggregates PowerBI variants deterministically", () => {
    expect(normalizeDemandQuery("PowerBI")).toBe("powerbi");
    expect(normalizeDemandQuery("  POWER   BI ")).toBe("power bi");
    expect(normalizeDemandQuery("power-bi")).toBe("power-bi");
  });

  it("classifies search outcomes", () => {
    expect(classifySearchOutcome(0)).toBe("ZERO_RESULT");
    expect(classifySearchOutcome(2)).toBe("LOW_RESULT");
    expect(classifySearchOutcome(5)).toBe("HEALTHY_RESULT");
  });
});

describe("M26 provider health", () => {
  it("flags failing and low-yield providers without auto-disable", () => {
    expect(
      classifyProviderHealth({
        sampleSize: 20,
        failureRate: 0.5,
        duplicateRate: 0.1,
        daysSinceLastSuccess: 1,
      }),
    ).toBe("FAILING");
    expect(
      classifyProviderHealth({
        sampleSize: 20,
        failureRate: 0.05,
        duplicateRate: 0.9,
        daysSinceLastSuccess: 1,
      }),
    ).toBe("LOW_YIELD");
  });
});

describe("M26 work queues", () => {
  it("surfaces empty categories and zero-result demand with action links", () => {
    const queues = buildCoverageWorkQueues({
      baseline: null,
      categories: [
        {
          categorySlug: "azure",
          categoryName: "Azure",
          publishedEligible: 0,
          draft: 0,
          archived: 0,
          candidatesOpen: 2,
          added30d: 0,
          coverage: "EMPTY",
        },
      ],
      funnel: null,
      providers: [],
      demand: {
        windowDays: 30,
        totalSearches: 10,
        zeroResultSearches: 4,
        lowResultSearches: 1,
        healthySearches: 5,
        topUnmet: [],
      },
    });

    expect(queues.some((q) => q.id === "empty-categories")).toBe(true);
    expect(queues.some((q) => q.href === "/admin/discovery/demand")).toBe(true);
  });
});

describe("M26 coverage-aware interleave", () => {
  it("prefers EMPTY category buckets earlier without dropping others", () => {
    const queries = [
      { id: "h1", category: "healthy-cat" },
      { id: "h2", category: "healthy-cat" },
      { id: "e1", category: "empty-cat" },
      { id: "e2", category: "empty-cat" },
    ];
    const coverage = new Map([
      ["healthy-cat", "HEALTHY" as const],
      ["empty-cat", "EMPTY" as const],
    ]);
    const selected = interleaveByCategory(queries, 2, coverage);
    expect(selected[0]?.category).toBe("empty-cat");
    expect(selected.map((q) => q.category)).toContain("healthy-cat");
  });
});
