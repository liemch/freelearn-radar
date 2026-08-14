import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "@/db";
import {
  categories,
  courseCategories,
  courseEmbeddings,
  courseTopicTags,
  courses,
  providers,
  topicTags,
} from "@/db/schema";
import { apiUsageLog } from "@/db/schema/api-usage-log";
import {
  countEmbeddingsByStatus,
  findCourseEmbedding,
  listEmbeddingsByStatus,
  markCourseEmbeddingFailed,
  markCourseEmbeddingOk,
  upsertCourseEmbeddingPending,
} from "@/db/repositories/course-embedding-repository";
import {
  buildSemanticDocument,
  SEMANTIC_DOCUMENT_VERSION,
} from "@/domain/embedding/semantic-document";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider";
import { createEmbeddingProviderFromEnv } from "@/services/embedding/embedding-provider";

export type EmbedBatchSummary = {
  considered: number;
  embedded: number;
  skipped: number;
  failed: number;
  providerConfigured: boolean;
};

async function loadCourseSemanticContext(db: Db, courseId: string) {
  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      level: courses.level,
      durationMinutes: courses.durationMinutes,
      language: courses.language,
      priceType: courses.priceType,
      certificateType: courses.certificateType,
      freeDurability: courses.freeDurability,
      description: courses.description,
      shortDescription: courses.shortDescription,
      providerName: providers.name,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(eq(courses.id, courseId))
    .limit(1);

  const course = courseRows[0];
  if (!course) return null;

  const categoryRows = await db
    .select({ name: categories.name })
    .from(courseCategories)
    .innerJoin(categories, eq(courseCategories.categoryId, categories.id))
    .where(eq(courseCategories.courseId, courseId));

  const topicRows = await db
    .select({ nameEn: topicTags.nameEn, nameVi: topicTags.nameVi })
    .from(courseTopicTags)
    .innerJoin(topicTags, eq(courseTopicTags.tagId, topicTags.id))
    .where(eq(courseTopicTags.courseId, courseId));

  return {
    course,
    categoryNames: categoryRows.map((r) => r.name),
    topicTagNames: topicRows.map((r) => r.nameEn || r.nameVi).filter(Boolean),
  };
}

export async function enqueueCourseEmbedding(
  db: Db,
  courseId: string,
): Promise<void> {
  const env = getServerEnv();
  const ctx = await loadCourseSemanticContext(db, courseId);
  if (!ctx) return;

  const doc = buildSemanticDocument({
    title: ctx.course.title,
    providerName: ctx.course.providerName,
    categoryNames: ctx.categoryNames,
    topicTagNames: ctx.topicTagNames,
    level: ctx.course.level,
    durationMinutes: ctx.course.durationMinutes,
    language: ctx.course.language,
    priceType: ctx.course.priceType,
    certificateType: ctx.course.certificateType,
    freeDurability: ctx.course.freeDurability,
    summaryVi: ctx.course.description,
    whyLearn: ctx.course.shortDescription,
    embedAiDerived: env.EMBED_AI_DERIVED_FIELDS === "true",
  });

  await upsertCourseEmbeddingPending(db, {
    courseId,
    embeddingModel: env.EMBEDDING_MODEL,
    embeddingVersion: env.EMBEDDING_VERSION,
    semanticDocumentVersion: doc.version || SEMANTIC_DOCUMENT_VERSION,
    contentHash: doc.contentHash,
  });
}

export async function enqueuePublishedCourses(
  db: Db,
  limit = 500,
): Promise<number> {
  const published = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.status, "PUBLISHED"))
    .limit(limit);

  for (const row of published) {
    await enqueueCourseEmbedding(db, row.id);
  }
  return published.length;
}

async function logEmbeddingUsage(
  db: Db,
  input: {
    ok: boolean;
    latencyMs: number;
    units?: number;
    error?: string;
    courseId?: string;
    model: string;
  },
) {
  try {
    await db.insert(apiUsageLog).values({
      kind: "embedding",
      provider: "embedding",
      operation: "generate",
      courseId: input.courseId ?? null,
      ok: input.ok,
      latencyMs: input.latencyMs,
      units: input.units ?? null,
      workerVersion: getServerEnv().EMBEDDING_VERSION,
      error: input.error ?? null,
      metaJson: { model: input.model },
    });
  } catch (error) {
    logger.warn("embedding.usage_log", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function runEmbeddingBatch(
  db: Db,
  options?: {
    limit?: number;
    provider?: EmbeddingProvider | null;
  },
): Promise<EmbedBatchSummary> {
  const env = getServerEnv();
  const limit = options?.limit ?? env.EMBEDDING_BATCH_SIZE;
  const provider =
    options?.provider ?? createEmbeddingProviderFromEnv(env);

  const summary: EmbedBatchSummary = {
    considered: 0,
    embedded: 0,
    skipped: 0,
    failed: 0,
    providerConfigured: Boolean(provider),
  };

  if (!provider) {
    return summary;
  }

  const pending = await listEmbeddingsByStatus(
    db,
    "PENDING",
    limit,
    env.EMBEDDING_MODEL,
    env.EMBEDDING_VERSION,
  );
  summary.considered = pending.length;

  for (const row of pending) {
    try {
      const ctx = await loadCourseSemanticContext(db, row.courseId);
      if (!ctx) {
        await markCourseEmbeddingFailed(db, row.id, "Course not found");
        summary.failed += 1;
        continue;
      }

      const doc = buildSemanticDocument({
        title: ctx.course.title,
        providerName: ctx.course.providerName,
        categoryNames: ctx.categoryNames,
        topicTagNames: ctx.topicTagNames,
        level: ctx.course.level,
        durationMinutes: ctx.course.durationMinutes,
        language: ctx.course.language,
        priceType: ctx.course.priceType,
        certificateType: ctx.course.certificateType,
        freeDurability: ctx.course.freeDurability,
        summaryVi: ctx.course.description,
        whyLearn: ctx.course.shortDescription,
        embedAiDerived: env.EMBED_AI_DERIVED_FIELDS === "true",
      });

      if (doc.contentHash !== row.contentHash) {
        await upsertCourseEmbeddingPending(db, {
          courseId: row.courseId,
          embeddingModel: env.EMBEDDING_MODEL,
          embeddingVersion: env.EMBEDDING_VERSION,
          semanticDocumentVersion: doc.version,
          contentHash: doc.contentHash,
        });
      }

      const result = await provider.generate([doc.text]);
      await logEmbeddingUsage(db, {
        ok: true,
        latencyMs: result.latencyMs,
        units: result.usageTokens,
        courseId: row.courseId,
        model: result.model,
      });

      const fresh = await findCourseEmbedding(
        db,
        row.courseId,
        env.EMBEDDING_MODEL,
        env.EMBEDDING_VERSION,
      );
      if (!fresh) {
        summary.failed += 1;
        continue;
      }

      await markCourseEmbeddingOk(db, fresh.id, result.embeddings[0]!);
      summary.embedded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Embedding failed";
      await markCourseEmbeddingFailed(db, row.id, message);
      await logEmbeddingUsage(db, {
        ok: false,
        latencyMs: 0,
        error: message,
        courseId: row.courseId,
        model: env.EMBEDDING_MODEL,
      });
      summary.failed += 1;
      logger.error("embedding.batch.item", {
        courseId: row.courseId,
        error: message,
      });
    }
  }

  logger.info("embedding.batch", { status: "success", ...summary });
  return summary;
}

export async function getEmbeddingQueueSnapshot(db: Db) {
  const env = getServerEnv();
  return countEmbeddingsByStatus(
    db,
    env.EMBEDDING_MODEL,
    env.EMBEDDING_VERSION,
  );
}

export async function markEmbeddingsStaleForCourses(
  db: Db,
  courseIds: string[],
): Promise<void> {
  if (courseIds.length === 0) return;
  const env = getServerEnv();
  await db
    .update(courseEmbeddings)
    .set({ status: "STALE", updatedAt: new Date() })
    .where(
      and(
        inArray(courseEmbeddings.courseId, courseIds),
        eq(courseEmbeddings.embeddingModel, env.EMBEDDING_MODEL),
        eq(courseEmbeddings.embeddingVersion, env.EMBEDDING_VERSION),
        eq(courseEmbeddings.status, "OK"),
      ),
    );
}
