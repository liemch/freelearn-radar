import type { Db } from "@/db";
import {
  insertApiUsage,
  summarizeApiUsage,
  type ApiUsageInsert,
} from "@/db/repositories/api-usage-repository";
import { logger } from "@/lib/logger";

/**
 * Every metered outbound dependency writes here. Keeping the vocabulary closed
 * means the budget view groups by something stable instead of by whatever
 * string a call site invented.
 */
export type ApiUsageKind =
  | "search"
  | "ai_analysis"
  | "embedding"
  | "email"
  | "monitor_fetch"
  | "source_fetch";

export type RecordApiUsageInput = {
  kind: ApiUsageKind;
  provider?: string | null;
  operation?: string | null;
  courseId?: string | null;
  domain?: string | null;
  httpStatus?: number | null;
  ok: boolean;
  latencyMs?: number | null;
  units?: number | null;
  workerVersion?: string | null;
  error?: string | null;
  meta?: Record<string, unknown> | null;
};

function toInsert(input: RecordApiUsageInput): ApiUsageInsert {
  return {
    kind: input.kind,
    provider: input.provider ?? null,
    operation: input.operation ?? null,
    courseId: input.courseId ?? null,
    domain: input.domain ?? null,
    httpStatus: input.httpStatus ?? null,
    ok: input.ok,
    latencyMs: input.latencyMs ?? null,
    units: input.units ?? 1,
    costUsd: null,
    workerVersion: input.workerVersion ?? null,
    error: input.error ? input.error.slice(0, 500) : null,
    metaJson: input.meta ?? null,
  };
}

/**
 * Best effort: a usage row must never fail the call it measures, or the
 * accounting becomes the outage.
 */
export async function recordApiUsage(
  db: Db,
  input: RecordApiUsageInput,
): Promise<void> {
  try {
    await insertApiUsage(db, toInsert(input));
  } catch (error) {
    logger.warn("admin.api_usage.write", {
      kind: input.kind,
      operation: input.operation ?? null,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export type MeasuredApiUsageMeta = Omit<
  RecordApiUsageInput,
  "ok" | "latencyMs" | "error"
>;

/**
 * Times `run`, records one usage row for either outcome, and rethrows so the
 * caller's own error handling is unchanged.
 */
export async function measureApiUsage<T>(
  db: Db,
  meta: MeasuredApiUsageMeta,
  run: () => Promise<T>,
  describe?: (result: T) => Partial<RecordApiUsageInput>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await run();
    const observed = describe ? describe(result) : {};
    await recordApiUsage(db, {
      ...meta,
      ...observed,
      meta: { ...(meta.meta ?? {}), ...(observed.meta ?? {}) },
      ok: true,
      latencyMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await recordApiUsage(db, {
      ...meta,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

export { summarizeApiUsage };
