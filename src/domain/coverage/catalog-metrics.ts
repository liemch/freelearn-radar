import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  categories,
  courseCategories,
  courseCandidates,
  courseTopicTags,
  courses,
  discoveryQueries,
  providers,
  topicTags,
} from "@/db/schema";
import {
  classifyCoverageCount,
  type CoverageStatus,
} from "@/domain/coverage/classify-coverage";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import type { PriceType } from "@/domain/course/types";

export type CatalogBaseline = {
  measured: true;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  coursesAdded7d: number;
  coursesAdded30d: number;
  coursesVerified7d: number;
  coursesVerified30d: number;
  imageCoverageRate: number | null;
  descriptionCoverageRate: number | null;
  categoryCoverageRate: number | null;
  freshVerificationRate30d: number | null;
  activeCouponNote: string;
};

export type CategoryCoverageRow = {
  categorySlug: string;
  categoryName: string;
  publishedEligible: number;
  draft: number;
  archived: number;
  candidatesOpen: number;
  added30d: number;
  coverage: CoverageStatus;
};

export type TopicCoverageRow = {
  topicSlug: string;
  topicName: string;
  publishedEligible: number;
  coverage: CoverageStatus;
};

export type ProviderCoverageRow = {
  providerSlug: string;
  providerName: string;
  publishedEligible: number;
  coverage: CoverageStatus;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getCatalogBaseline(db: Db): Promise<CatalogBaseline> {
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED')::int`,
      draft: sql<number>`count(*) filter (where ${courses.status} = 'DRAFT')::int`,
      archived: sql<number>`count(*) filter (where ${courses.status} = 'ARCHIVED')::int`,
      added7d: sql<number>`count(*) filter (where ${courses.createdAt} >= ${since7})::int`,
      added30d: sql<number>`count(*) filter (where ${courses.createdAt} >= ${since30})::int`,
      verified7d: sql<number>`count(*) filter (where ${courses.lastVerifiedAt} >= ${since7})::int`,
      verified30d: sql<number>`count(*) filter (where ${courses.lastVerifiedAt} >= ${since30})::int`,
      withImage: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.imageStatus} in ('OK','FALLBACK'))::int`,
      withDescription: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.description} is not null and length(trim(${courses.description})) > 0)::int`,
      publishedVerified30: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.lastVerifiedAt} >= ${since30})::int`,
    })
    .from(courses);

  const published = row?.published ?? 0;

  const [categorized] = await db
    .select({
      n: sql<number>`count(distinct ${courseCategories.courseId})::int`,
    })
    .from(courseCategories)
    .innerJoin(courses, eq(courses.id, courseCategories.courseId))
    .where(eq(courses.status, "PUBLISHED"));

  const categorizedCount = categorized?.n ?? 0;

  return {
    measured: true,
    totalCourses: row?.total ?? 0,
    publishedCourses: published,
    draftCourses: row?.draft ?? 0,
    archivedCourses: row?.archived ?? 0,
    coursesAdded7d: row?.added7d ?? 0,
    coursesAdded30d: row?.added30d ?? 0,
    coursesVerified7d: row?.verified7d ?? 0,
    coursesVerified30d: row?.verified30d ?? 0,
    imageCoverageRate: published > 0 ? (row?.withImage ?? 0) / published : null,
    descriptionCoverageRate:
      published > 0 ? (row?.withDescription ?? 0) / published : null,
    categoryCoverageRate: published > 0 ? categorizedCount / published : null,
    freshVerificationRate30d:
      published > 0 ? (row?.publishedVerified30 ?? 0) / published : null,
    activeCouponNote:
      "ACTIVE_100_OFF rate: use /admin/coupons — not merged into a fake quality score.",
  };
}

export async function listCategoryCoverage(
  db: Db,
): Promise<CategoryCoverageRow[]> {
  const since30 = daysAgo(30);
  const allCats = await db.select().from(categories).orderBy(categories.slug);

  const publishedRows = await db
    .select({
      categorySlug: categories.slug,
      courseId: courses.id,
      status: courses.status,
      priceType: courses.priceType,
      publishedAt: courses.publishedAt,
      createdAt: courses.createdAt,
    })
    .from(courseCategories)
    .innerJoin(categories, eq(categories.id, courseCategories.categoryId))
    .innerJoin(courses, eq(courses.id, courseCategories.courseId));

  const bySlug = new Map<
    string,
    {
      publishedEligible: number;
      draft: number;
      archived: number;
      added30d: number;
    }
  >();

  for (const cat of allCats) {
    bySlug.set(cat.slug, {
      publishedEligible: 0,
      draft: 0,
      archived: 0,
      added30d: 0,
    });
  }

  for (const row of publishedRows) {
    const bucket = bySlug.get(row.categorySlug);
    if (!bucket) continue;
    if (row.status === "PUBLISHED") {
      if (isEligibleForFreeLists(row.priceType as PriceType)) {
        bucket.publishedEligible += 1;
      }
      const stamped = row.publishedAt ?? row.createdAt;
      if (stamped >= since30) bucket.added30d += 1;
    } else if (row.status === "DRAFT") {
      bucket.draft += 1;
    } else if (row.status === "ARCHIVED") {
      bucket.archived += 1;
    }
  }

  const candidateByCategory = await countOpenCandidatesByCategory(db);

  return allCats.map((cat) => {
    const bucket = bySlug.get(cat.slug)!;
    return {
      categorySlug: cat.slug,
      categoryName: cat.name,
      publishedEligible: bucket.publishedEligible,
      draft: bucket.draft,
      archived: bucket.archived,
      candidatesOpen: candidateByCategory.get(cat.slug) ?? 0,
      added30d: bucket.added30d,
      coverage: classifyCoverageCount(bucket.publishedEligible),
    };
  });
}

async function countOpenCandidatesByCategory(
  db: Db,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      category: discoveryQueries.category,
      n: sql<number>`count(*)::int`,
    })
    .from(courseCandidates)
    .innerJoin(
      discoveryQueries,
      and(
        eq(courseCandidates.searchQuery, discoveryQueries.query),
        eq(courseCandidates.provider, discoveryQueries.provider),
      ),
    )
    .where(
      inArray(courseCandidates.discoveryStatus, [
        "DISCOVERED",
        "FETCHED",
        "ANALYZED",
        "READY_FOR_REVIEW",
      ]),
    )
    .groupBy(discoveryQueries.category);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.category) map.set(row.category, row.n);
  }
  return map;
}

export async function listTopicCoverage(db: Db): Promise<TopicCoverageRow[]> {
  const rows = await db
    .select({
      topicSlug: topicTags.slug,
      topicName: topicTags.nameVi,
      n: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED')::int`,
    })
    .from(topicTags)
    .leftJoin(courseTopicTags, eq(courseTopicTags.tagId, topicTags.id))
    .leftJoin(courses, eq(courses.id, courseTopicTags.courseId))
    .groupBy(topicTags.slug, topicTags.nameVi)
    .orderBy(desc(sql`count(*) filter (where ${courses.status} = 'PUBLISHED')`));

  return rows.map((row) => ({
    topicSlug: row.topicSlug,
    topicName: row.topicName,
    publishedEligible: row.n,
    coverage: classifyCoverageCount(row.n),
  }));
}

export async function listProviderCoverage(
  db: Db,
): Promise<ProviderCoverageRow[]> {
  const rows = await db
    .select({
      providerSlug: providers.slug,
      providerName: providers.name,
      courseId: courses.id,
      status: courses.status,
      priceType: courses.priceType,
    })
    .from(providers)
    .leftJoin(courses, eq(courses.providerId, providers.id))
    .orderBy(providers.slug);

  const bySlug = new Map<
    string,
    { name: string; publishedEligible: number }
  >();

  for (const row of rows) {
    const bucket = bySlug.get(row.providerSlug) ?? {
      name: row.providerName,
      publishedEligible: 0,
    };
    if (
      row.status === "PUBLISHED" &&
      row.priceType &&
      isEligibleForFreeLists(row.priceType as PriceType)
    ) {
      bucket.publishedEligible += 1;
    }
    bySlug.set(row.providerSlug, bucket);
  }

  return [...bySlug.entries()].map(([providerSlug, bucket]) => ({
    providerSlug,
    providerName: bucket.name,
    publishedEligible: bucket.publishedEligible,
    coverage: classifyCoverageCount(bucket.publishedEligible),
  }));
}

export function summarizeCoverageHealth(
  rows: Array<{ coverage: CoverageStatus }>,
): {
  empty: number;
  thin: number;
  healthy: number;
  strong: number;
} {
  const out = { empty: 0, thin: 0, healthy: 0, strong: 0 };
  for (const row of rows) {
    switch (row.coverage) {
      case "EMPTY":
        out.empty += 1;
        break;
      case "THIN":
        out.thin += 1;
        break;
      case "HEALTHY":
        out.healthy += 1;
        break;
      case "STRONG":
        out.strong += 1;
        break;
    }
  }
  return out;
}

export async function getImageCoverageByProvider(db: Db) {
  return db
    .select({
      providerSlug: providers.slug,
      published: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED')::int`,
      missing: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.imageStatus} in ('MISSING','BROKEN'))::int`,
      ok: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.imageStatus} = 'OK')::int`,
      fallback: sql<number>`count(*) filter (where ${courses.status} = 'PUBLISHED' and ${courses.imageStatus} = 'FALLBACK')::int`,
    })
    .from(providers)
    .leftJoin(courses, eq(courses.providerId, providers.id))
    .groupBy(providers.slug)
    .orderBy(providers.slug);
}
