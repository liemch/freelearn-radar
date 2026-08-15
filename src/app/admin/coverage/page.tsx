import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminMetric, AdminMetricRow } from "@/components/admin/admin-metric";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { DiscoveryPlanButton } from "@/components/admin/discovery-plan-button";
import { coverageThresholds } from "@/config/coverage-thresholds";
import { listDiscoveryCategoryStats } from "@/db/repositories/coupon-repository";
import {
  getCatalogBaseline,
  listCategoryCoverage,
  listProviderCoverage,
  summarizeCoverageHealth,
} from "@/domain/coverage/catalog-metrics";
import {
  getDiscoveryFunnelSnapshot,
  listTopFailureReasons,
} from "@/domain/coverage/discovery-funnel";
import { listDiscoveryRecommendations } from "@/domain/coverage/discovery-recommendations";
import { diagnoseProviders } from "@/domain/coverage/provider-diagnostics";
import { listProviderEffectiveness } from "@/domain/coverage/provider-effectiveness";
import { captureCatalogGrowthSnapshot } from "@/domain/coverage/growth-snapshot";
import { getUnmetIntentSummary } from "@/domain/coverage/unmet-intent";
import { buildCoverageWorkQueues } from "@/domain/coverage/work-queues";
import { deriveGapClosureStatus } from "@/domain/coverage/gap-closure";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { courses } from "@/db/schema";
import { and, eq, lt, or, sql, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function coverageBadgeClass(status: string): string {
  switch (status) {
    case "EMPTY":
      return "text-red-700 dark:text-red-400";
    case "THIN":
      return "text-amber-700 dark:text-amber-400";
    case "STRONG":
      return "text-emerald-700 dark:text-emerald-400";
    default:
      return "text-foreground";
  }
}

export default async function AdminCoveragePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const [
    baseline,
    categories,
    providersCov,
    discoveryStats,
    funnel,
    failures,
    providerEff,
    demand,
    missingImages,
    staleTruth,
    recommendations,
    growthT0,
  ] = await Promise.all([
    withDb("admin.coverage.baseline", (db) => getCatalogBaseline(db), null),
    withDb("admin.coverage.categories", (db) => listCategoryCoverage(db), []),
    withDb("admin.coverage.providersCov", (db) => listProviderCoverage(db), []),
    withDb(
      "admin.coverage.discoveryStats",
      (db) => listDiscoveryCategoryStats(db),
      [],
    ),
    withDb(
      "admin.coverage.funnel",
      (db) => getDiscoveryFunnelSnapshot(db, 30),
      null,
    ),
    withDb("admin.coverage.failures", (db) => listTopFailureReasons(db, 12), []),
    withDb(
      "admin.coverage.providerEff",
      (db) => listProviderEffectiveness(db),
      [],
    ),
    withDb(
      "admin.coverage.demand",
      (db) => getUnmetIntentSummary(db, { windowDays: 30, topN: 8 }),
      null,
    ),
    withDb(
      "admin.coverage.missingImages",
      async (db) => {
        const [row] = await db
          .select({
            n: sql<number>`count(*)::int`,
          })
          .from(courses)
          .where(
            and(
              eq(courses.status, "PUBLISHED"),
              sql`${courses.imageStatus} in ('MISSING','BROKEN')`,
            ),
          );
        return row?.n ?? 0;
      },
      0,
    ),
    withDb(
      "admin.coverage.staleTruth",
      async (db) => {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [row] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(courses)
          .where(
            and(
              eq(courses.status, "PUBLISHED"),
              or(isNull(courses.lastVerifiedAt), lt(courses.lastVerifiedAt, cutoff)),
            ),
          );
        return row?.n ?? 0;
      },
      0,
    ),
    withDb(
      "admin.coverage.recommendations",
      (db) =>
        listDiscoveryRecommendations(db, {
          limit: 20,
          minPriority: "P1_HIGH",
        }),
      [],
    ),
    withDb(
      "admin.coverage.growthT0",
      (db) => captureCatalogGrowthSnapshot(db, "T0"),
      null,
    ),
  ]);

  const diagnostics = diagnoseProviders(providerEff);

  const health = summarizeCoverageHealth(categories);
  const queues = buildCoverageWorkQueues({
    baseline,
    categories,
    funnel,
    providers: providerEff,
    demand,
    missingImages,
    staleTruth,
  });

  const discoveryBySlug = new Map(
    discoveryStats.map((row) => [row.categorySlug, row]),
  );

  const sortedCategories = [...categories].sort((a, b) => {
    const rank = (s: string) =>
      ({ EMPTY: 0, THIN: 1, HEALTHY: 2, STRONG: 3 })[s] ?? 9;
    return (
      rank(a.coverage) - rank(b.coverage) ||
      a.publishedEligible - b.publishedEligible ||
      a.categorySlug.localeCompare(b.categorySlug)
    );
  });

  return (
    <>
      <AdminPageHeader
        title={t.coverage.heading}
        description={t.coverage.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        {t.coverage.starvationHint}{" "}
        <span className="text-foreground">
          ({t.coverage.thresholds}: empty≤{coverageThresholds.emptyMax}, thin≤
          {coverageThresholds.thinMax}, healthy≤{coverageThresholds.healthyMax})
        </span>
      </div>

      {baseline ? (
        <AdminMetricRow className="mb-4">
          <AdminMetric
            label={t.coverage.publishedTotal}
            value={String(baseline.publishedCourses)}
          />
          <AdminMetric
            label={t.coverage.domainEmpty}
            value={String(health.empty)}
          />
          <AdminMetric
            label={t.coverage.domainThin}
            value={String(health.thin)}
          />
          <AdminMetric
            label={t.coverage.new7d}
            value={String(baseline.coursesAdded7d)}
          />
          <AdminMetric
            label={t.coverage.new30d}
            value={String(baseline.coursesAdded30d)}
          />
          <AdminMetric
            label={t.coverage.imageCoverage}
            value={formatRate(baseline.imageCoverageRate)}
          />
          <AdminMetric
            label={t.coverage.freshTruth}
            value={formatRate(baseline.freshVerificationRate30d)}
          />
          <AdminMetric
            label={t.coverage.zeroResult7d}
            value={demand ? String(demand.zeroResultSearches) : "—"}
          />
        </AdminMetricRow>
      ) : null}

      <AdminPanel title={t.coverage.workQueues} className="mb-4">
        {queues.length === 0 ? (
          <AdminEmptyState message={t.coverage.queuesEmpty} />
        ) : (
          <ul className="divide-y divide-border">
            {queues.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {item.count}
                  </span>
                </div>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      <div id="recommendations">
        <AdminPanel title={t.coverage.recommendationsHeading} className="mb-4">
          <p className="mb-3 text-[0.8125rem] text-muted-foreground">
            {t.coverage.recommendationsHint}
            {growthT0
              ? ` · T0 ${growthT0.capturedAt.slice(0, 19)}Z · empty=${growthT0.emptyCategories} thin=${growthT0.thinCategories}`
              : " · T0 NOT AVAILABLE"}
          </p>
          {recommendations.length === 0 ? (
            <AdminEmptyState message={t.coverage.recommendationsEmpty} />
          ) : (
            <AdminTable caption={t.coverage.recommendationsHeading}>
              <thead>
                <AdminTr>
                  <AdminTh>{t.coverage.priority}</AdminTh>
                  <AdminTh>{t.coverage.category}</AdminTh>
                  <AdminTh>{t.coverage.status}</AdminTh>
                  <AdminTh>{t.coverage.demand}</AdminTh>
                  <AdminTh>{t.coverage.gapStatus}</AdminTh>
                  <AdminTh>{t.coverage.provider}</AdminTh>
                  <AdminTh>{t.coverage.actions}</AdminTh>
                </AdminTr>
              </thead>
              <tbody>
                {recommendations.map((row) => {
                  const cat = categories.find(
                    (c) => c.categorySlug === row.categorySlug,
                  );
                  const gap = deriveGapClosureStatus({
                    coverage: row.coverage,
                    demandBand: row.demandBand,
                    openCandidates: cat?.candidatesOpen ?? 0,
                    hasDryRunPlan: true,
                    publishedEligible: row.publishedEligible,
                  });
                  return (
                    <AdminTr key={row.categorySlug}>
                      <AdminTd>
                        <code className="text-xs font-semibold">
                          {row.priority}
                        </code>
                      </AdminTd>
                      <AdminTd>
                        <span className="font-medium">{row.categoryName}</span>
                        <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                          {row.publishedEligible} eligible · budget ≤
                          {row.budget.maxCandidates}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <span className={coverageBadgeClass(row.coverage)}>
                          {row.coverage}
                        </span>
                      </AdminTd>
                      <AdminTd>
                        {row.demandBand}
                        <span className="ml-1 text-muted-foreground">
                          ({row.demandSearches30d})
                        </span>
                      </AdminTd>
                      <AdminTd>
                        <code className="text-xs">{gap}</code>
                      </AdminTd>
                      <AdminTd>
                        {row.recommendedProviders.join(", ") || "—"}
                      </AdminTd>
                      <AdminTd>
                        <DiscoveryPlanButton
                          categorySlug={row.categorySlug}
                          labels={{
                            viewPlan: t.coverage.viewPlan,
                            hidePlan: t.coverage.hidePlan,
                            runDiscovery: t.coverage.linkDiscovery,
                            loading: t.coverage.planLoading,
                            failed: t.coverage.planFailed,
                            noMutate: t.coverage.planNoMutate,
                            queries: t.coverage.planQueries,
                            maxCandidates: t.coverage.planMaxCandidates,
                            provider: t.coverage.provider,
                            health: t.coverage.status,
                          }}
                        />
                      </AdminTd>
                    </AdminTr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>
      </div>

      {diagnostics.length > 0 ? (
        <AdminPanel title={t.coverage.diagnosticsHeading} className="mb-4">
          <AdminTable caption={t.coverage.diagnosticsHeading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.coverage.provider}</AdminTh>
                <AdminTh>{t.coverage.status}</AdminTh>
                <AdminTh>{t.coverage.diagClass}</AdminTh>
                <AdminTh>{t.coverage.recommendation}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {diagnostics.map((row) => (
                <AdminTr key={row.provider}>
                  <AdminTd>{row.provider}</AdminTd>
                  <AdminTd>
                    <span className={coverageBadgeClass(row.health)}>
                      {row.health}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    <code className="text-xs">{row.primaryFailureClass}</code>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-muted-foreground">
                      {row.recommendedAction}
                    </span>
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        </AdminPanel>
      ) : null}

      {funnel ? (
        <AdminPanel title={t.coverage.funnelHeading} className="mb-4">
          <p className="mb-3 text-[0.8125rem] text-muted-foreground">
            {t.coverage.funnelHint} ({funnel.windowDays}d)
          </p>
          <AdminMetricRow>
            <AdminMetric
              label="DISCOVERED"
              value={String(funnel.discovered)}
            />
            <AdminMetric label="FETCHED" value={String(funnel.fetched)} />
            <AdminMetric
              label="ANALYZED/READY"
              value={String(funnel.analyzedOrReady)}
            />
            <AdminMetric label="APPROVED" value={String(funnel.approved)} />
            <AdminMetric
              label={t.coverage.preIngestRejects}
              value={String(funnel.preIngestRejections)}
            />
            <AdminMetric
              label={t.coverage.discoveryToApproved}
              value={formatRate(funnel.discoveryToApprovedRate)}
            />
          </AdminMetricRow>
          <p className="mt-2 text-xs text-muted-foreground">
            {funnel.verificationNote}
          </p>
        </AdminPanel>
      ) : null}

      <AdminPanel title={t.coverage.failureReasons} className="mb-4">
        {failures.length === 0 ? (
          <AdminEmptyState message={t.coverage.failuresEmpty} />
        ) : (
          <AdminTable caption={t.coverage.failureReasons}>
            <thead>
              <AdminTr>
                <AdminTh>{t.coverage.reason}</AdminTh>
                <AdminTh numeric>{t.coverage.count}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {failures.map((row) => (
                <AdminTr key={row.reason}>
                  <AdminTd>
                    <code className="text-xs">{row.reason}</code>
                  </AdminTd>
                  <AdminTd numeric>{row.count}</AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>

      <div id="matrix">
      <AdminPanel title={t.coverage.matrixHeading} className="mb-4">
        {sortedCategories.length === 0 ? (
          <AdminEmptyState message={t.coverage.empty} />
        ) : (
          <AdminTable caption={t.coverage.matrixHeading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.coverage.category}</AdminTh>
                <AdminTh numeric>{t.coverage.publishedEligible}</AdminTh>
                <AdminTh numeric>{t.coverage.candidatesOpen}</AdminTh>
                <AdminTh numeric>{t.coverage.new30d}</AdminTh>
                <AdminTh numeric>{t.coverage.queriesRun}</AdminTh>
                <AdminTh>{t.coverage.status}</AdminTh>
                <AdminTh>{t.coverage.actions}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {sortedCategories.map((row) => {
                const ops = discoveryBySlug.get(row.categorySlug);
                return (
                  <AdminTr key={row.categorySlug}>
                    <AdminTd>
                      <span className="font-medium">{row.categoryName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.categorySlug}
                      </span>
                    </AdminTd>
                    <AdminTd numeric>{row.publishedEligible}</AdminTd>
                    <AdminTd numeric>{row.candidatesOpen}</AdminTd>
                    <AdminTd numeric>{row.added30d}</AdminTd>
                    <AdminTd numeric>{ops?.queriesRun ?? 0}</AdminTd>
                    <AdminTd>
                      <span className={coverageBadgeClass(row.coverage)}>
                        {row.coverage}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link
                          href={`/admin/courses?category=${encodeURIComponent(row.categorySlug)}`}
                          className="text-primary hover:underline"
                        >
                          {t.coverage.linkCourses}
                        </Link>
                        <Link
                          href={`/admin/candidates`}
                          className="text-primary hover:underline"
                        >
                          {t.coverage.linkCandidates}
                        </Link>
                        <Link
                          href={`/admin/discovery?category=${encodeURIComponent(row.categorySlug)}`}
                          className="text-primary hover:underline"
                        >
                          {t.coverage.linkDiscovery}
                        </Link>
                      </div>
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
      </div>

      <div id="providers">
      <AdminPanel
        title={t.coverage.providersHeading}
        className="mb-4"
      >
        {providerEff.length === 0 ? (
          <AdminEmptyState message={t.coverage.providersEmpty} />
        ) : (
          <AdminTable caption={t.coverage.providersHeading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.coverage.provider}</AdminTh>
                <AdminTh numeric>{t.coverage.publishedEligible}</AdminTh>
                <AdminTh numeric>{t.coverage.candidatesFound}</AdminTh>
                <AdminTh numeric>{t.coverage.yield}</AdminTh>
                <AdminTh numeric>{t.coverage.dupRate}</AdminTh>
                <AdminTh>{t.coverage.status}</AdminTh>
                <AdminTh>{t.coverage.recommendation}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {providerEff.map((row) => {
                const cov = providersCov.find(
                  (p) => p.providerSlug === row.provider,
                );
                return (
                  <AdminTr key={row.provider}>
                    <AdminTd>
                      <Link
                        href={`/admin/providers`}
                        className="font-medium hover:underline"
                      >
                        {row.provider}
                      </Link>
                    </AdminTd>
                    <AdminTd numeric>
                      {cov?.publishedEligible ?? row.publishedCourses}
                    </AdminTd>
                    <AdminTd numeric>{row.candidatesTotal}</AdminTd>
                    <AdminTd numeric>{formatRate(row.publishYield)}</AdminTd>
                    <AdminTd numeric>{formatRate(row.duplicateRate)}</AdminTd>
                    <AdminTd>
                      <span className={coverageBadgeClass(row.health)}>
                        {row.health}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-muted-foreground">
                        {row.recommendation}
                      </span>
                    </AdminTd>
                  </AdminTr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
      </div>
    </>
  );
}
