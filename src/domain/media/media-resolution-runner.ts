/**
 * M21.6 — Bounded media resolution pass.
 *
 * The resolver decides status; this runner is what actually gives it a runtime
 * path and persists the `image_*` columns, so the M21.6 quality metrics and the
 * admin media filters describe real state instead of schema defaults.
 *
 * Media is never Truth: a course whose image cannot be resolved keeps its
 * publication status and only records why the card will fall back.
 */

import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { mapCourseIdsToPrimaryCategorySlug } from "@/db/repositories/course-repository";
import { courses, providers } from "@/db/schema";
import { resolveCourseMedia } from "@/domain/media/media-resolver";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type MediaResolutionSummary = {
  enabled: boolean;
  processed: number;
  ok: number;
  broken: number;
  blocked: number;
  fallback: number;
  pending: number;
  errors: number;
  skippedReason: string | null;
};

function emptySummary(
  partial: Partial<MediaResolutionSummary> = {},
): MediaResolutionSummary {
  return {
    enabled: false,
    processed: 0,
    ok: 0,
    broken: 0,
    blocked: 0,
    fallback: 0,
    pending: 0,
    errors: 0,
    skippedReason: null,
    ...partial,
  };
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await fn(items[index]!);
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
}

type MediaCandidate = {
  id: string;
  imageSourceUrl: string | null;
  imageStorageUrl: string | null;
  imagePolicy: string | null;
  providerSlug: string | null;
  categorySlug: string | null;
};

/**
 * Oldest-checked-first so a bounded run eventually covers the catalog instead
 * of re-checking the same rows.
 *
 * The category is resolved in a second query rather than joined: a course with
 * three categories would otherwise consume three rows of `limit`, making the
 * batch size mean "joined rows" instead of "courses to check".
 */
export async function listCoursesDueForMediaResolution(
  db: Db,
  limit: number,
  staleBefore: Date,
): Promise<MediaCandidate[]> {
  const rows = await db
    .select({
      id: courses.id,
      imageSourceUrl: courses.imageSourceUrl,
      imageStorageUrl: courses.imageStorageUrl,
      imagePolicy: courses.imagePolicy,
      providerSlug: providers.slug,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(
      and(
        eq(courses.status, "PUBLISHED"),
        or(
          isNull(courses.imageCheckedAt),
          // Typed operator: postgres-js rejects a JS Date passed into a raw sql
          // template, so this must not be expressed as one.
          lt(courses.imageCheckedAt, staleBefore),
        ),
      ),
    )
    .orderBy(sql`${courses.imageCheckedAt} ASC NULLS FIRST`, asc(courses.id))
    .limit(limit);

  if (rows.length === 0) return [];

  const categorySlugByCourseId = await mapCourseIdsToPrimaryCategorySlug(
    db,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    categorySlug: categorySlugByCourseId.get(row.id) ?? null,
  }));
}

export async function runMediaResolution(
  db: Db,
  options?: { limit?: number; concurrency?: number; now?: Date },
): Promise<MediaResolutionSummary> {
  const env = getServerEnv();
  if (env.FEATURE_MEDIA_RESOLVER !== "true") {
    return emptySummary({ skippedReason: "FEATURE_MEDIA_RESOLVER_off" });
  }

  const now = options?.now ?? new Date();
  const limit = options?.limit ?? env.MEDIA_RESOLVE_LIMIT;
  const concurrency = options?.concurrency ?? env.IMAGE_RESOLVE_CONCURRENCY;
  const staleBefore = new Date(
    now.getTime() - env.MEDIA_RECHECK_HOURS * 60 * 60 * 1000,
  );

  const summary = emptySummary({ enabled: true });
  const candidates = await listCoursesDueForMediaResolution(
    db,
    limit,
    staleBefore,
  );

  await mapPool(candidates, concurrency, async (candidate) => {
    try {
      const result = await resolveCourseMedia(
        {
          imageSourceUrl: candidate.imageSourceUrl,
          imageStorageUrl: candidate.imageStorageUrl,
          imagePolicy: candidate.imagePolicy,
          providerSlug: candidate.providerSlug,
          categorySlug: candidate.categorySlug,
        },
        { validateRemote: true },
      );

      await db
        .update(courses)
        .set({
          imageResolvedUrl: result.imageResolvedUrl,
          imageSourceType: result.imageSourceType,
          imageStatus: result.imageStatus,
          imageWidth: result.imageWidth,
          imageHeight: result.imageHeight,
          imageHash: result.imageHash,
          imageFallbackReason: result.imageFallbackReason,
          imageCheckedAt: result.imageCheckedAt,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, candidate.id));

      summary.processed += 1;
      if (result.imageStatus === "OK") summary.ok += 1;
      else if (result.imageStatus === "BROKEN") summary.broken += 1;
      else if (result.imageStatus === "BLOCKED") summary.blocked += 1;
      else if (result.imageStatus === "FALLBACK") summary.fallback += 1;
      else if (result.imageStatus === "PENDING") summary.pending += 1;
    } catch (error) {
      summary.errors += 1;
      logger.warn("media.resolve.course", {
        status: "error",
        courseId: candidate.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  logger.info("media.resolve", { status: "success", ...summary });
  return summary;
}
