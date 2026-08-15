import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Db } from "@/db";
import {
  couponCandidates,
  couponSources,
  courseOffers,
  courses,
  discoveryCategoryStats,
  providers,
  type CouponCandidate,
  type CouponSource,
  type CourseOffer,
  type DiscoveryCategoryStat,
  type NewCouponCandidate,
  type NewCouponSource,
  type NewCourseOffer,
} from "@/db/schema";
import type { CouponOfferStatus } from "@/domain/course/types";

export async function listCouponSources(db: Db): Promise<CouponSource[]> {
  return db.select().from(couponSources).orderBy(asc(couponSources.priority));
}

export async function listEnabledCouponSources(db: Db): Promise<CouponSource[]> {
  return db
    .select()
    .from(couponSources)
    .where(eq(couponSources.enabled, true))
    .orderBy(asc(couponSources.priority));
}

export async function upsertCouponSource(
  db: Db,
  input: NewCouponSource,
): Promise<CouponSource> {
  const existing = await db
    .select()
    .from(couponSources)
    .where(eq(couponSources.sourceKey, input.sourceKey))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(couponSources)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(couponSources.id, existing[0].id))
      .returning();
    return updated!;
  }

  const [created] = await db.insert(couponSources).values(input).returning();
  return created!;
}

/**
 * Returns null when the offer_url already exists. Discovery runs concurrently
 * and retries after timeout, so a duplicate is an expected outcome resolved by
 * the unique index rather than an error.
 */
export async function insertCouponCandidate(
  db: Db,
  input: NewCouponCandidate,
): Promise<CouponCandidate | null> {
  const rows = await db
    .insert(couponCandidates)
    .values(input)
    .onConflictDoNothing({ target: couponCandidates.offerUrl })
    .returning();
  return rows[0] ?? null;
}

export async function listCouponCandidates(
  db: Db,
  options?: { status?: CouponOfferStatus; limit?: number },
): Promise<CouponCandidate[]> {
  const limit = options?.limit ?? 100;
  if (options?.status) {
    return db
      .select()
      .from(couponCandidates)
      .where(eq(couponCandidates.status, options.status))
      .orderBy(desc(couponCandidates.discoveredAt))
      .limit(limit);
  }
  return db
    .select()
    .from(couponCandidates)
    .orderBy(desc(couponCandidates.discoveredAt))
    .limit(limit);
}

export async function upsertCourseOffer(
  db: Db,
  input: NewCourseOffer,
): Promise<CourseOffer> {
  const existing = await db
    .select()
    .from(courseOffers)
    .where(eq(courseOffers.offerUrl, input.offerUrl))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(courseOffers)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(courseOffers.id, existing[0].id))
      .returning();
    return updated!;
  }

  const [created] = await db.insert(courseOffers).values(input).returning();
  return created!;
}

export async function listCourseOffers(
  db: Db,
  options?: {
    status?: CouponOfferStatus | CouponOfferStatus[];
    limit?: number;
  },
): Promise<CourseOffer[]> {
  const limit = options?.limit ?? 100;
  const statuses = options?.status
    ? Array.isArray(options.status)
      ? options.status
      : [options.status]
    : null;

  if (statuses) {
    return db
      .select()
      .from(courseOffers)
      .where(inArray(courseOffers.status, statuses))
      .orderBy(desc(courseOffers.verifiedAt))
      .limit(limit);
  }

  return db
    .select()
    .from(courseOffers)
    .orderBy(desc(courseOffers.discoveredAt))
    .limit(limit);
}

/**
 * Public 100%-off offers. An offer past its recorded expiry is no longer an
 * active deal even if re-verification has not run yet (§126.4), so expiry is a
 * publication gate here and not only a recheck scheduling input.
 */
export async function listActive100OffOffers(
  db: Db,
  limit = 48,
  now: Date = new Date(),
) {
  return db
    .select({
      offer: courseOffers,
      course: courses,
      provider: providers,
    })
    .from(courseOffers)
    .leftJoin(courses, eq(courseOffers.courseId, courses.id))
    // Resolve the provider through the offer when it has one and through the
    // course otherwise. Joining on the offer column alone meant a null
    // provider_id silently removed a verified offer from the public surface.
    .leftJoin(
      providers,
      sql`${providers.id} = coalesce(${courseOffers.providerId}, ${courses.providerId})`,
    )
    .where(
      and(
        eq(courseOffers.status, "ACTIVE_100_OFF"),
        // Typed operators, not a raw sql template: postgres-js rejects a bare
        // JS Date as a template parameter, which made this query throw on every
        // request while `withDb` rendered it as "no deals today".
        or(isNull(courseOffers.expiresAt), gt(courseOffers.expiresAt, now)),
      ),
    )
    .orderBy(desc(courseOffers.verifiedAt))
    .limit(limit);
}

export async function listOffersDueForRecheck(db: Db, limit = 25) {
  const now = new Date();
  const rows = await db
    .select({ offer: courseOffers })
    .from(courseOffers)
    .leftJoin(courses, eq(courseOffers.courseId, courses.id))
    .where(
      and(
        inArray(courseOffers.status, [
          "ACTIVE_100_OFF",
          "ACTIVE_DISCOUNTED",
          "UNKNOWN",
          "DISCOVERED",
          "VERIFYING",
          // BLOCKED is transient — a rate limit or a captcha, not a verdict on
          // the coupon. Excluding it stranded the offer permanently even though
          // nextCouponRecheckAt already computes a 48h backoff for it.
          "BLOCKED",
        ]),
        or(
          isNull(courseOffers.nextRecheckAt),
          lte(courseOffers.nextRecheckAt, now),
        ),
        // Archived/draft courses are out of normal operations — do not burn
        // verification budget on them.
        or(isNull(courseOffers.courseId), eq(courses.status, "PUBLISHED")),
      ),
    )
    .orderBy(asc(courseOffers.nextRecheckAt))
    .limit(limit);

  return rows.map((row) => row.offer);
}

export async function updateCourseOfferStatus(
  db: Db,
  id: string,
  patch: Partial<{
    status: CouponOfferStatus;
    verifiedAt: Date | null;
    expiresAt: Date | null;
    nextRecheckAt: Date | null;
    lastError: string | null;
    discountPercent: number | null;
    priceAfterDiscount: string | null;
    courseId: string | null;
  }>,
) {
  const [updated] = await db
    .update(courseOffers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(courseOffers.id, id))
    .returning();
  return updated ?? null;
}

export async function updateCouponCandidateStatus(
  db: Db,
  id: string,
  patch: Partial<{
    status: CouponOfferStatus;
    courseId: string | null;
    lastError: string | null;
  }>,
) {
  const [updated] = await db
    .update(couponCandidates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(couponCandidates.id, id))
    .returning();
  return updated ?? null;
}

export async function findCouponCandidateByOfferUrl(
  db: Db,
  offerUrl: string,
): Promise<CouponCandidate | null> {
  const [row] = await db
    .select()
    .from(couponCandidates)
    .where(eq(couponCandidates.offerUrl, offerUrl))
    .limit(1);
  return row ?? null;
}

export async function recordCouponSourceRun(
  db: Db,
  sourceId: string,
  patch: {
    healthStatus: CouponSource["healthStatus"];
    candidatesDiscoveredDelta?: number;
    success: boolean;
  },
) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(couponSources)
    .where(eq(couponSources.id, sourceId))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(couponSources)
    .set({
      healthStatus: patch.healthStatus,
      lastRunAt: now,
      lastSuccessAt: patch.success ? now : existing.lastSuccessAt,
      candidatesDiscovered:
        existing.candidatesDiscovered + (patch.candidatesDiscoveredDelta ?? 0),
      updatedAt: now,
    })
    .where(eq(couponSources.id, sourceId))
    .returning();
  return updated ?? null;
}

export async function listDiscoveryCategoryStats(
  db: Db,
): Promise<DiscoveryCategoryStat[]> {
  return db
    .select()
    .from(discoveryCategoryStats)
    .orderBy(asc(discoveryCategoryStats.categorySlug));
}

export async function bumpDiscoveryCategoryStats(
  db: Db,
  categorySlug: string,
  delta: {
    queriesRun?: number;
    candidatesFound?: number;
    verifiedCount?: number;
    publishedCount?: number;
    zeroCandidateRuns?: number;
    lastDiscoveredAt?: Date | null;
  },
) {
  const existing = await db
    .select()
    .from(discoveryCategoryStats)
    .where(eq(discoveryCategoryStats.categorySlug, categorySlug))
    .limit(1);

  if (!existing[0]) {
    await db.insert(discoveryCategoryStats).values({
      categorySlug,
      queriesRun: delta.queriesRun ?? 0,
      candidatesFound: delta.candidatesFound ?? 0,
      verifiedCount: delta.verifiedCount ?? 0,
      publishedCount: delta.publishedCount ?? 0,
      zeroCandidateRuns: delta.zeroCandidateRuns ?? 0,
      lastDiscoveredAt: delta.lastDiscoveredAt ?? null,
    });
    return;
  }

  await db
    .update(discoveryCategoryStats)
    .set({
      queriesRun: existing[0].queriesRun + (delta.queriesRun ?? 0),
      candidatesFound:
        existing[0].candidatesFound + (delta.candidatesFound ?? 0),
      verifiedCount: existing[0].verifiedCount + (delta.verifiedCount ?? 0),
      publishedCount:
        existing[0].publishedCount + (delta.publishedCount ?? 0),
      zeroCandidateRuns:
        existing[0].zeroCandidateRuns + (delta.zeroCandidateRuns ?? 0),
      lastDiscoveredAt:
        delta.lastDiscoveredAt ?? existing[0].lastDiscoveredAt,
      updatedAt: new Date(),
    })
    .where(eq(discoveryCategoryStats.id, existing[0].id));
}

export async function couponOpsSummary(db: Db) {
  const [counts] = await db
    .select({
      active100: sql<number>`count(*) filter (where ${courseOffers.status} = 'ACTIVE_100_OFF')`,
      expired: sql<number>`count(*) filter (where ${courseOffers.status} = 'EXPIRED')`,
      invalid: sql<number>`count(*) filter (where ${courseOffers.status} = 'INVALID')`,
      unknown: sql<number>`count(*) filter (where ${courseOffers.status} = 'UNKNOWN')`,
      discovered: sql<number>`count(*) filter (where ${courseOffers.status} = 'DISCOVERED')`,
      total: sql<number>`count(*)`,
    })
    .from(courseOffers);

  const sources = await listCouponSources(db);
  const candidates = await db
    .select({
      total: sql<number>`count(*)`,
      discovered: sql<number>`count(*) filter (where ${couponCandidates.status} = 'DISCOVERED')`,
    })
    .from(couponCandidates);

  return {
    offers: counts ?? {
      active100: 0,
      expired: 0,
      invalid: 0,
      unknown: 0,
      discovered: 0,
      total: 0,
    },
    sources,
    candidates: candidates[0] ?? { total: 0, discovered: 0 },
  };
}
