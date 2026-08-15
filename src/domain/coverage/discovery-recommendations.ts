import type { Db } from "@/db";
import { listEnabledDiscoveryQueries } from "@/db/repositories/discovery-query-repository";
import type { CategoryCoverageRow } from "@/domain/coverage/catalog-metrics";
import { listCategoryCoverage } from "@/domain/coverage/catalog-metrics";
import type { CoverageStatus } from "@/domain/coverage/classify-coverage";
import type { ProviderHealthStatus } from "@/domain/coverage/classify-coverage";
import {
  boundedCandidateBudget,
  classifyDemandBand,
  classifyGrowthPriority,
  explainGrowthPriority,
  growthPriorityRank,
  recommendationSortScore,
  type DemandBand,
  type GrowthPriority,
} from "@/domain/coverage/growth-priority";
import { listProviderEffectiveness } from "@/domain/coverage/provider-effectiveness";
import { getUnmetIntentSummary } from "@/domain/coverage/unmet-intent";
import { normalizeDemandQuery } from "@/domain/coverage/unmet-intent";

export type DiscoveryRecommendation = {
  categorySlug: string;
  categoryName: string;
  coverage: CoverageStatus;
  publishedEligible: number;
  demandBand: DemandBand;
  demandSearches30d: number;
  priority: GrowthPriority;
  reason: string;
  recommendedProviders: string[];
  providerHealthNotes: Array<{
    provider: string;
    health: ProviderHealthStatus;
    publishYield: number | null;
  }>;
  suggestedQueries: Array<{
    id: string;
    provider: string;
    query: string;
    junkRate: number | null;
    lastRunAt: Date | null;
  }>;
  budget: { queries: number; maxPerQuery: number; maxCandidates: number };
  lastDiscoveredAt: Date | null;
};

export type DiscoveryDryRunPlan = {
  generatedAt: string;
  categorySlug: string;
  categoryName: string;
  coverage: CoverageStatus;
  publishedEligible: number;
  priority: GrowthPriority;
  reason: string;
  demandBand: DemandBand;
  steps: Array<{
    order: number;
    provider: string;
    queryId: string;
    query: string;
    maxResults: number;
    providerHealth: ProviderHealthStatus | "UNKNOWN";
    why: string;
  }>;
  totals: {
    queries: number;
    maxCandidates: number;
  };
  warnings: string[];
  mutatesDatabase: false;
  createsCourses: false;
  publishesCourses: false;
};

function mapDemandToCategories(
  unmet: Awaited<ReturnType<typeof getUnmetIntentSummary>>,
  categories: CategoryCoverageRow[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const cat of categories) {
    counts.set(cat.categorySlug, 0);
  }

  for (const row of unmet.topUnmet) {
    const q = normalizeDemandQuery(row.normalizedQuery ?? "");
    if (!q) continue;
    for (const cat of categories) {
      const slug = cat.categorySlug.toLowerCase();
      const name = cat.categoryName.toLowerCase();
      if (
        q.includes(slug.replace(/-/g, " ")) ||
        q.includes(slug) ||
        (name.length >= 3 && q.includes(name.toLowerCase()))
      ) {
        counts.set(
          cat.categorySlug,
          (counts.get(cat.categorySlug) ?? 0) + row.searches,
        );
      }
    }
  }
  return counts;
}

/**
 * Build actionable discovery recommendations from live M26 signals.
 * Never invents providers — only uses enabled discovery_queries rows.
 */
export async function listDiscoveryRecommendations(
  db: Db,
  options: { limit?: number; minPriority?: GrowthPriority } = {},
): Promise<DiscoveryRecommendation[]> {
  const limit = options.limit ?? 40;
  const [categories, queries, providers, demand] = await Promise.all([
    listCategoryCoverage(db),
    listEnabledDiscoveryQueries(db),
    listProviderEffectiveness(db),
    getUnmetIntentSummary(db, { windowDays: 30, topN: 80 }),
  ]);

  const demandByCat = mapDemandToCategories(demand, categories);
  const providerHealth = new Map(
    providers.map((p) => [p.provider, p] as const),
  );

  const queriesByCategory = new Map<string, typeof queries>();
  for (const q of queries) {
    const list = queriesByCategory.get(q.category) ?? [];
    list.push(q);
    queriesByCategory.set(q.category, list);
  }

  const rows: DiscoveryRecommendation[] = [];

  for (const cat of categories) {
    const catQueries = queriesByCategory.get(cat.categorySlug) ?? [];
    if (catQueries.length === 0) continue;

    const demandSearches = demandByCat.get(cat.categorySlug) ?? 0;
    const demandBand = classifyDemandBand(demandSearches);

    const providerSlugs = [...new Set(catQueries.map((q) => q.provider))];
    const providerNotes = providerSlugs.map((provider) => {
      const eff = providerHealth.get(provider);
      return {
        provider,
        health: (eff?.health ?? "UNKNOWN") as ProviderHealthStatus,
        publishYield: eff?.publishYield ?? null,
      };
    });

    const healthyProviders = providerNotes.filter(
      (p) => p.health === "HEALTHY" || p.health === "UNKNOWN",
    );
    const bestHealth =
      healthyProviders[0]?.health ??
      providerNotes.sort((a, b) => {
        const rank = (h: ProviderHealthStatus) =>
          (
            {
              HEALTHY: 0,
              UNKNOWN: 1,
              LOW_YIELD: 2,
              DEGRADED: 3,
              FAILING: 4,
            } as const
          )[h];
        return rank(a.health) - rank(b.health);
      })[0]?.health ??
      null;

    const avgYield =
      providerNotes
        .map((p) => p.publishYield)
        .filter((n): n is number => n != null).length > 0
        ? providerNotes
            .map((p) => p.publishYield)
            .filter((n): n is number => n != null)
            .reduce((a, b) => a + b, 0) /
          providerNotes.filter((p) => p.publishYield != null).length
        : null;

    const priority = classifyGrowthPriority({
      coverage: cat.coverage,
      demandBand,
      providerHealthBest: bestHealth,
      recentYield: avgYield,
    });

    const preferredProviders =
      healthyProviders.length > 0
        ? healthyProviders.map((p) => p.provider)
        : providerNotes
            .filter((p) => p.health !== "FAILING")
            .map((p) => p.provider);

    const suggested = catQueries
      .filter((q) => preferredProviders.includes(q.provider))
      .sort((a, b) => {
        const ja = a.junkRate != null ? Number(a.junkRate) : 0.5;
        const jb = b.junkRate != null ? Number(b.junkRate) : 0.5;
        return ja - jb;
      })
      .slice(0, 5)
      .map((q) => ({
        id: q.id,
        provider: q.provider,
        query: q.query,
        junkRate: q.junkRate != null ? Number(q.junkRate) : null,
        lastRunAt: q.lastRunAt,
      }));

    if (suggested.length === 0) continue;

    const budget = boundedCandidateBudget({
      priority,
      queryCount: suggested.length,
      resultLimitPerQuery: 10,
    });

    const lastDiscoveredAt =
      suggested
        .map((s) => s.lastRunAt)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    rows.push({
      categorySlug: cat.categorySlug,
      categoryName: cat.categoryName,
      coverage: cat.coverage,
      publishedEligible: cat.publishedEligible,
      demandBand,
      demandSearches30d: demandSearches,
      priority,
      reason: explainGrowthPriority({
        coverage: cat.coverage,
        demandBand,
        priority,
      }),
      recommendedProviders: [...new Set(suggested.map((s) => s.provider))],
      providerHealthNotes: providerNotes,
      suggestedQueries: suggested,
      budget,
      lastDiscoveredAt,
    });
  }

  const minRank = options.minPriority
    ? growthPriorityRank(options.minPriority)
    : growthPriorityRank("P2_NORMAL");

  return rows
    .filter((r) => growthPriorityRank(r.priority) <= minRank)
    .sort((a, b) => {
      const pr = growthPriorityRank(a.priority) - growthPriorityRank(b.priority);
      if (pr !== 0) return pr;
      return (
        recommendationSortScore({
          coverage: b.coverage,
          zeroResultDemand: b.demandSearches30d,
          recentYield: null,
        }) -
        recommendationSortScore({
          coverage: a.coverage,
          zeroResultDemand: a.demandSearches30d,
          recentYield: null,
        })
      );
    })
    .slice(0, limit);
}

/**
 * Safe dry-run: plan only. No DB writes, no course creation.
 */
export async function buildDiscoveryDryRunPlan(
  db: Db,
  categorySlug: string,
): Promise<DiscoveryDryRunPlan | null> {
  const recommendations = await listDiscoveryRecommendations(db, {
    limit: 200,
    minPriority: "P3_LOW",
  });
  const rec = recommendations.find((r) => r.categorySlug === categorySlug);
  if (!rec) return null;

  const warnings: string[] = [];
  const failing = rec.providerHealthNotes.filter((p) => p.health === "FAILING");
  if (failing.length > 0) {
    warnings.push(
      `Provider FAILING: ${failing.map((p) => p.provider).join(", ")} — ưu tiên diagnostics trước khi chạy rộng.`,
    );
  }
  const highJunk = rec.suggestedQueries.filter(
    (q) => q.junkRate != null && q.junkRate >= 0.8,
  );
  if (highJunk.length > 0) {
    warnings.push(
      `${highJunk.length} query có junkRate cao — plan vẫn bounded; cân nhắc giảm priority.`,
    );
  }

  const steps = rec.suggestedQueries
    .slice(0, rec.budget.queries)
    .map((q, index) => {
      const health =
        rec.providerHealthNotes.find((p) => p.provider === q.provider)
          ?.health ?? "UNKNOWN";
      return {
        order: index + 1,
        provider: q.provider,
        queryId: q.id,
        query: q.query,
        maxResults: rec.budget.maxPerQuery,
        providerHealth: health,
        why:
          health === "HEALTHY" || health === "UNKNOWN"
            ? "Provider ổn / chưa đủ mẫu; query thuộc category ưu tiên."
            : `Provider ${health}; vẫn đưa vào plan có giới hạn để operator quyết định.`,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    categorySlug: rec.categorySlug,
    categoryName: rec.categoryName,
    coverage: rec.coverage,
    publishedEligible: rec.publishedEligible,
    priority: rec.priority,
    reason: rec.reason,
    demandBand: rec.demandBand,
    steps,
    totals: {
      queries: steps.length,
      maxCandidates: steps.length * rec.budget.maxPerQuery,
    },
    warnings,
    mutatesDatabase: false,
    createsCourses: false,
    publishesCourses: false,
  };
}
