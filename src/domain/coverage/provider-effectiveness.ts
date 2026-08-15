import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseCandidates,
  courses,
  discoveryQueries,
  providers,
} from "@/db/schema";
import {
  classifyProviderHealth,
  type ProviderHealthStatus,
} from "@/domain/coverage/classify-coverage";

export type ProviderEffectivenessRow = {
  provider: string;
  queriesEnabled: number;
  querySuccesses: number;
  queryFailures: number;
  failureRate: number | null;
  candidatesTotal: number;
  candidatesApproved: number;
  candidatesDuplicate: number;
  candidatesInvalid: number;
  duplicateRate: number | null;
  publishYield: number | null;
  publishedCourses: number;
  daysSinceLastQuerySuccess: number | null;
  health: ProviderHealthStatus;
  recommendation: string;
};

export async function listProviderEffectiveness(
  db: Db,
): Promise<ProviderEffectivenessRow[]> {
  const queryRows = await db
    .select({
      provider: discoveryQueries.provider,
      enabled: sql<number>`count(*) filter (where ${discoveryQueries.enabled})::int`,
      successes: sql<number>`coalesce(sum(${discoveryQueries.successCount}),0)::int`,
      failures: sql<number>`coalesce(sum(${discoveryQueries.failureCount}),0)::int`,
      lastRunAt: sql<Date | null>`max(${discoveryQueries.lastRunAt})`,
    })
    .from(discoveryQueries)
    .groupBy(discoveryQueries.provider);

  const candidateRows = await db
    .select({
      provider: courseCandidates.provider,
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'APPROVED')::int`,
      duplicate: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'DUPLICATE')::int`,
      invalid: sql<number>`count(*) filter (where ${courseCandidates.discoveryStatus} = 'INVALID')::int`,
    })
    .from(courseCandidates)
    .groupBy(courseCandidates.provider);

  const publishedRows = await db
    .select({
      provider: providers.slug,
      n: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED')::int`,
    })
    .from(providers)
    .leftJoin(courses, eq(courses.providerId, providers.id))
    .groupBy(providers.slug);

  const candByProvider = new Map(
    candidateRows.map((r) => [r.provider ?? "__unknown__", r]),
  );
  const pubByProvider = new Map(publishedRows.map((r) => [r.provider, r.n]));

  const now = Date.now();
  const rows: ProviderEffectivenessRow[] = [];

  const providersSeen = new Set<string>();
  for (const q of queryRows) providersSeen.add(q.provider);
  for (const c of candidateRows) {
    if (c.provider) providersSeen.add(c.provider);
  }

  for (const provider of [...providersSeen].sort()) {
    const q = queryRows.find((r) => r.provider === provider);
    const c = candByProvider.get(provider);
    const successes = q?.successes ?? 0;
    const failures = q?.failures ?? 0;
    const attempts = successes + failures;
    const failureRate = attempts > 0 ? failures / attempts : null;
    const total = c?.total ?? 0;
    const approved = c?.approved ?? 0;
    const duplicate = c?.duplicate ?? 0;
    const invalid = c?.invalid ?? 0;
    const duplicateRate = total > 0 ? duplicate / total : null;
    const publishYield = total > 0 ? approved / total : null;
    const lastRun = q?.lastRunAt ? new Date(q.lastRunAt).getTime() : null;
    const daysSinceLastQuerySuccess =
      lastRun != null
        ? Math.floor((now - lastRun) / (24 * 60 * 60 * 1000))
        : null;

    const health = classifyProviderHealth({
      sampleSize: Math.max(total, attempts),
      failureRate,
      duplicateRate,
      daysSinceLastSuccess: daysSinceLastQuerySuccess,
    });

    rows.push({
      provider,
      queriesEnabled: q?.enabled ?? 0,
      querySuccesses: successes,
      queryFailures: failures,
      failureRate,
      candidatesTotal: total,
      candidatesApproved: approved,
      candidatesDuplicate: duplicate,
      candidatesInvalid: invalid,
      duplicateRate,
      publishYield,
      publishedCourses: pubByProvider.get(provider) ?? 0,
      daysSinceLastQuerySuccess,
      health,
      recommendation: recommendProviderAction(health, {
        failureRate,
        duplicateRate,
        publishYield,
      }),
    });
  }

  return rows.sort((a, b) => {
    const rank = (h: ProviderHealthStatus) =>
      ({ FAILING: 0, DEGRADED: 1, LOW_YIELD: 2, UNKNOWN: 3, HEALTHY: 4 })[h];
    return rank(a.health) - rank(b.health) || a.provider.localeCompare(b.provider);
  });
}

function recommendProviderAction(
  health: ProviderHealthStatus,
  signals: {
    failureRate: number | null;
    duplicateRate: number | null;
    publishYield: number | null;
  },
): string {
  switch (health) {
    case "FAILING":
      return "Kiểm tra adapter / rate limit / domain filter — không tắt tự động.";
    case "DEGRADED":
      return "Không có discovery thành công gần đây — chạy thủ công hoặc kiểm tra query.";
    case "LOW_YIELD":
      return signals.duplicateRate != null && signals.duplicateRate >= 0.75
        ? "Trùng lặp cao — giảm tần suất / đổi query."
        : "Yield thấp — rà soát query và URL shape.";
    case "HEALTHY":
      return "Giữ cadence hiện tại.";
    case "UNKNOWN":
      return "Chưa đủ mẫu — tiếp tục đo.";
  }
}

export async function getProviderImageCoverage(db: Db, providerSlug: string) {
  return db
    .select({
      imageStatus: courses.imageStatus,
      n: sql<number>`count(*)::int`,
    })
    .from(courses)
    .innerJoin(providers, eq(providers.id, courses.providerId))
    .where(
      and(eq(providers.slug, providerSlug), eq(courses.status, "PUBLISHED")),
    )
    .groupBy(courses.imageStatus)
    .orderBy(desc(sql`count(*)`));
}
