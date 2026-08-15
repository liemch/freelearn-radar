import { and, eq, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { courseEmbeddings, courses } from "@/db/schema";
import {
  getCachedQueryEmbedding,
  putCachedQueryEmbedding,
} from "@/db/repositories/course-embedding-repository";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { hashSearchQuery } from "@/domain/search/normalize-query";
import { cosineSimilarity } from "@/domain/search/fusion";
import { getServerEnv } from "@/lib/env";
import {
  createEmbeddingProviderFromEnv,
  type EmbeddingProvider,
} from "@/services/embedding/embedding-provider";

export type SemanticHit = {
  courseId: string;
  score: number;
};

export type SemanticSearchResult = {
  hits: SemanticHit[];
  degraded: boolean;
  cacheHit: boolean;
  latencyMs: number;
};

export type RelevanceFloor =
  | { calibrated: true; minCosine: number }
  | { calibrated: false };

/**
 * Reads the §89.5 relevance floor.
 *
 * Returning top-K by cosine with no minimum means a query with no good match
 * still yields 50 "hits" — the best of a bad set — which then survive fusion
 * and make `unmet_intent` read false. That is the "lấp trang bằng match yếu"
 * outcome §89.5 forbids and the reason §20 exists.
 *
 * The plan requires the threshold to come from the labelled evaluation set, so
 * an unset value is reported as uncalibrated rather than defaulted.
 */
export function readRelevanceFloor(raw: string | undefined): RelevanceFloor {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { calibrated: false };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return { calibrated: false };
  }
  return { calibrated: true, minCosine: parsed };
}

/**
 * Brute-force cosine over OK embeddings for the active model/version.
 * Never mixes versions. Truth-filters ineligible price types.
 */
export async function searchSemantic(
  db: Db,
  query: string,
  options?: {
    topK?: number;
    provider?: EmbeddingProvider | null;
    timeoutMs?: number;
    floor?: RelevanceFloor;
  },
): Promise<SemanticSearchResult> {
  const env = getServerEnv();
  const started = Date.now();
  const topK = options?.topK ?? env.VECTOR_TOP_K;
  const timeoutMs = options?.timeoutMs ?? env.VECTOR_QUERY_TIMEOUT_MS;
  const provider =
    options?.provider ?? createEmbeddingProviderFromEnv(env);

  if (!provider || !query.trim()) {
    return {
      hits: [],
      degraded: true,
      cacheHit: false,
      latencyMs: Date.now() - started,
    };
  }

  const queryHash = hashSearchQuery(query.trim().toLowerCase());
  let cacheHit = false;
  let queryVector: number[] | null = await getCachedQueryEmbedding(
    db,
    queryHash,
    env.EMBEDDING_MODEL,
    env.EMBEDDING_VERSION,
  );

  if (queryVector) {
    cacheHit = true;
  } else {
    try {
      const embedPromise = provider.generate([query.trim()]);
      const result = await Promise.race([
        embedPromise,
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), Math.max(timeoutMs, 50)),
        ),
      ]);
      if (!result) {
        return {
          hits: [],
          degraded: true,
          cacheHit: false,
          latencyMs: Date.now() - started,
        };
      }
      queryVector = result.embeddings[0] ?? null;
      if (queryVector) {
        await putCachedQueryEmbedding(db, {
          queryHash,
          embeddingModel: env.EMBEDDING_MODEL,
          embeddingVersion: env.EMBEDDING_VERSION,
          embedding: queryVector,
        });
      }
    } catch {
      return {
        hits: [],
        degraded: true,
        cacheHit: false,
        latencyMs: Date.now() - started,
      };
    }
  }

  if (!queryVector) {
    return {
      hits: [],
      degraded: true,
      cacheHit,
      latencyMs: Date.now() - started,
    };
  }

  // Load active-version OK embeddings joined to published free-eligible courses.
  const rows = await db
    .select({
      courseId: courseEmbeddings.courseId,
      embedding: courseEmbeddings.embedding,
      priceType: courses.priceType,
      status: courses.status,
    })
    .from(courseEmbeddings)
    .innerJoin(courses, eq(courseEmbeddings.courseId, courses.id))
    .where(
      and(
        eq(courseEmbeddings.embeddingModel, env.EMBEDDING_MODEL),
        eq(courseEmbeddings.embeddingVersion, env.EMBEDDING_VERSION),
        eq(courseEmbeddings.status, "OK"),
        eq(courses.status, "PUBLISHED"),
      ),
    );

  const floor = options?.floor ?? readRelevanceFloor(env.RELEVANCE_FLOOR);
  const minCosine = floor.calibrated ? floor.minCosine : null;

  const scored: SemanticHit[] = [];
  for (const row of rows) {
    if (!row.embedding) continue;
    if (!isEligibleForFreeLists(row.priceType)) continue;
    // A dimension mismatch scores 0 rather than throwing, so a stale vector
    // from a superseded model cannot crash the request — it just cannot rank.
    const score = cosineSimilarity(queryVector, row.embedding);
    if (minCosine !== null && score < minCosine) continue;
    scored.push({ courseId: row.courseId, score });
  }

  scored.sort((a, b) => b.score - a.score || a.courseId.localeCompare(b.courseId));

  return {
    hits: scored.slice(0, topK),
    degraded: false,
    cacheHit,
    latencyMs: Date.now() - started,
  };
}

/** Escape hatch for SQL cosine when pgvector operators are preferred later. */
export function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export function cosineSqlExpression(
  columnSql: ReturnType<typeof sql>,
  queryLiteral: string,
) {
  return sql`1 - (${columnSql} <=> ${queryLiteral}::vector)`;
}
