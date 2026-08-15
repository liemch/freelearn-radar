import { and, eq, gt, inArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseEmbeddings,
  queryEmbeddingCache,
  type CourseEmbedding,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";

export async function findCourseEmbedding(
  db: Db,
  courseId: string,
  model: string,
  version: string,
): Promise<CourseEmbedding | null> {
  const rows = await db
    .select()
    .from(courseEmbeddings)
    .where(
      and(
        eq(courseEmbeddings.courseId, courseId),
        eq(courseEmbeddings.embeddingModel, model),
        eq(courseEmbeddings.embeddingVersion, version),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCourseEmbeddingPending(
  db: Db,
  input: {
    courseId: string;
    embeddingModel: string;
    embeddingVersion: string;
    semanticDocumentVersion: string;
    contentHash: string;
  },
): Promise<void> {
  const existing = await findCourseEmbedding(
    db,
    input.courseId,
    input.embeddingModel,
    input.embeddingVersion,
  );

  const now = new Date();
  if (existing) {
    if (
      existing.contentHash === input.contentHash &&
      existing.status === "OK"
    ) {
      return;
    }
    await db
      .update(courseEmbeddings)
      .set({
        status: "PENDING",
        contentHash: input.contentHash,
        semanticDocumentVersion: input.semanticDocumentVersion,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(courseEmbeddings.id, existing.id));
    return;
  }

  await db.insert(courseEmbeddings).values({
    courseId: input.courseId,
    embeddingModel: input.embeddingModel,
    embeddingVersion: input.embeddingVersion,
    semanticDocumentVersion: input.semanticDocumentVersion,
    contentHash: input.contentHash,
    status: "PENDING",
  });
}

export async function markCourseEmbeddingOk(
  db: Db,
  id: string,
  embedding: number[],
): Promise<void> {
  await db
    .update(courseEmbeddings)
    .set({
      embedding,
      status: "OK",
      embeddedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(courseEmbeddings.id, id));
}

export async function markCourseEmbeddingFailed(
  db: Db,
  id: string,
  error: string,
): Promise<void> {
  await db
    .update(courseEmbeddings)
    .set({
      status: "FAILED",
      lastError: error.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(courseEmbeddings.id, id));
}

export async function listEmbeddingsByStatus(
  db: Db,
  status: "PENDING" | "OK" | "FAILED" | "STALE",
  limit: number,
  model: string,
  version: string,
): Promise<CourseEmbedding[]> {
  return db
    .select()
    .from(courseEmbeddings)
    .where(
      and(
        eq(courseEmbeddings.status, status),
        eq(courseEmbeddings.embeddingModel, model),
        eq(courseEmbeddings.embeddingVersion, version),
      ),
    )
    .limit(limit);
}

export async function countEmbeddingsByStatus(
  db: Db,
  model: string,
  version: string,
): Promise<Record<"PENDING" | "OK" | "FAILED" | "STALE", number>> {
  const rows = await db
    .select({
      status: courseEmbeddings.status,
      count: sql<number>`count(*)::int`,
    })
    .from(courseEmbeddings)
    .where(
      and(
        eq(courseEmbeddings.embeddingModel, model),
        eq(courseEmbeddings.embeddingVersion, version),
      ),
    )
    .groupBy(courseEmbeddings.status);

  const result = { PENDING: 0, OK: 0, FAILED: 0, STALE: 0 };
  for (const row of rows) {
    result[row.status] = Number(row.count);
  }
  return result;
}

export async function findOkEmbeddingsForCourses(
  db: Db,
  courseIds: string[],
  model: string,
  version: string,
): Promise<CourseEmbedding[]> {
  if (courseIds.length === 0) return [];
  return db
    .select()
    .from(courseEmbeddings)
    .where(
      and(
        inArray(courseEmbeddings.courseId, courseIds),
        eq(courseEmbeddings.embeddingModel, model),
        eq(courseEmbeddings.embeddingVersion, version),
        eq(courseEmbeddings.status, "OK"),
      ),
    );
}

/**
 * Cache reads honour `QUERY_EMBEDDING_CACHE_TTL_DAYS` (§89.3). Without the TTL
 * a vector cached under a superseded model config would be served indefinitely.
 */
export async function getCachedQueryEmbedding(
  db: Db,
  queryHash: string,
  model: string,
  version: string,
  options?: { ttlDays?: number; now?: Date },
): Promise<number[] | null> {
  const now = options?.now ?? new Date();
  const ttlDays =
    options?.ttlDays ?? getServerEnv().QUERY_EMBEDDING_CACHE_TTL_DAYS;
  const cutoff = new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(queryEmbeddingCache)
    .where(
      and(
        eq(queryEmbeddingCache.queryHash, queryHash),
        eq(queryEmbeddingCache.embeddingModel, model),
        eq(queryEmbeddingCache.embeddingVersion, version),
        // Typed operator: a JS Date inside a raw sql template is rejected by
        // postgres-js, which would make every cache read throw.
        gt(queryEmbeddingCache.createdAt, cutoff),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(queryEmbeddingCache)
    .set({
      hitCount: sql`${queryEmbeddingCache.hitCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(queryEmbeddingCache.id, row.id));

  return row.embedding;
}

export async function putCachedQueryEmbedding(
  db: Db,
  input: {
    queryHash: string;
    embeddingModel: string;
    embeddingVersion: string;
    embedding: number[];
  },
): Promise<void> {
  const existing = await db
    .select({ id: queryEmbeddingCache.id })
    .from(queryEmbeddingCache)
    .where(
      and(
        eq(queryEmbeddingCache.queryHash, input.queryHash),
        eq(queryEmbeddingCache.embeddingModel, input.embeddingModel),
        eq(queryEmbeddingCache.embeddingVersion, input.embeddingVersion),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(queryEmbeddingCache)
      .set({
        embedding: input.embedding,
        lastUsedAt: new Date(),
        // Refreshing the vector restarts its TTL; otherwise a re-written row
        // would immediately read as expired again.
        createdAt: new Date(),
      })
      .where(eq(queryEmbeddingCache.id, existing[0].id));
    return;
  }

  await db.insert(queryEmbeddingCache).values({
    queryHash: input.queryHash,
    embeddingModel: input.embeddingModel,
    embeddingVersion: input.embeddingVersion,
    embedding: input.embedding,
  });
}
