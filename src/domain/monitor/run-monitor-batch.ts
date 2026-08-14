import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  apiUsageLog,
  courses,
  providers,
  type CoursePriceEvent,
} from "@/db/schema";
import { notifyWatchesForEvents } from "@/domain/alerts/notify-watches";
import { detectPriceEvents } from "@/domain/monitor/detect-events";
import {
  observeCourse,
  type CourseForObservation,
} from "@/domain/monitor/observe-course";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type MonitorBatchSummary = {
  considered: number;
  observed: number;
  blocked: number;
  events: number;
  errors: number;
};

export type RunMonitorBatchOptions = {
  limit?: number;
  concurrency?: number;
  now?: Date;
  detectEvents?: boolean;
};

const TIER_ORDER = sql`case ${courses.trackingTier}
  when 'HIGH' then 0
  when 'NORMAL' then 1
  when 'LOW' then 2
  when 'DORMANT' then 3
  else 4
end`;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

export async function selectDueCoursesForMonitor(
  db: Db,
  limit: number,
  now = new Date(),
): Promise<CourseForObservation[]> {
  const rows = await db
    .select({
      course: courses,
      provider: providers,
    })
    .from(courses)
    .innerJoin(providers, eq(courses.providerId, providers.id))
    .where(
      and(
        eq(courses.status, "PUBLISHED"),
        or(
          isNull(courses.nextObservationAt),
          lte(courses.nextObservationAt, now),
        ),
      ),
    )
    .orderBy(asc(TIER_ORDER), asc(courses.nextObservationAt))
    .limit(Math.max(0, limit));

  return rows.map((row) => ({
    ...row.course,
    provider: row.provider,
  }));
}

async function logUsage(
  db: Db,
  input: {
    courseId: string;
    domain: string | null;
    httpStatus: number | null;
    ok: boolean;
    latencyMs: number;
    workerVersion: string;
    error?: string | null;
    fetchStatus: string;
  },
): Promise<void> {
  await db.insert(apiUsageLog).values({
    kind: "monitor_fetch",
    provider: null,
    operation: "observe_course",
    courseId: input.courseId,
    domain: input.domain,
    httpStatus: input.httpStatus,
    ok: input.ok,
    latencyMs: input.latencyMs,
    units: 1,
    workerVersion: input.workerVersion,
    error: input.error ?? null,
    metaJson: { fetchStatus: input.fetchStatus },
  });
}

/**
 * Batch observe published courses that are due, detect confirmed events,
 * and record api_usage_log rows.
 */
export async function runMonitorBatch(
  db: Db,
  options: RunMonitorBatchOptions = {},
): Promise<MonitorBatchSummary> {
  const env = getServerEnv();
  const now = options.now ?? new Date();
  const limit = options.limit ?? env.MONITOR_DAILY_FETCH_BUDGET;
  const concurrency = options.concurrency ?? env.MONITOR_CONCURRENCY;
  const detect =
    options.detectEvents ?? true; /* always detect; auto-status gated separately */

  const due = await selectDueCoursesForMonitor(db, limit, now);
  const summary: MonitorBatchSummary = {
    considered: due.length,
    observed: 0,
    blocked: 0,
    events: 0,
    errors: 0,
  };

  if (due.length === 0) {
    return summary;
  }

  const outcomes = await mapPool(due, concurrency, async (course) => {
    const started = Date.now();
    const tallies = {
      observed: 0,
      blocked: 0,
      events: 0,
      errors: 0,
      createdEvents: [] as CoursePriceEvent[],
    };

    try {
      const observation = await observeCourse(db, course, { now });
      tallies.observed = 1;
      if (observation.fetchStatus === "BLOCKED") {
        tallies.blocked = 1;
      }

      await logUsage(db, {
        courseId: course.id,
        domain: course.provider?.domain ?? null,
        httpStatus: observation.httpStatus,
        ok: observation.fetchStatus === "OK",
        latencyMs: Date.now() - started,
        workerVersion: observation.workerVersion ?? env.MONITOR_WORKER_VERSION,
        error:
          observation.fetchStatus === "OK" ? null : observation.fetchStatus,
        fetchStatus: observation.fetchStatus,
      });

      if (detect && observation.fetchStatus === "OK") {
        const events = await detectPriceEvents(db, course.id, { now });
        tallies.events = events.length;
        tallies.createdEvents = events;
      }
    } catch (error) {
      tallies.errors = 1;
      logger.error("monitor.batch.item", {
        courseId: course.id,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      try {
        await logUsage(db, {
          courseId: course.id,
          domain: course.provider?.domain ?? null,
          httpStatus: null,
          ok: false,
          latencyMs: Date.now() - started,
          workerVersion: env.MONITOR_WORKER_VERSION,
          error: error instanceof Error ? error.message.slice(0, 500) : "error",
          fetchStatus: "ERROR",
        });
      } catch {
        // usage log must not mask the original failure path
      }
    }

    return tallies;
  });

  const allEvents: CoursePriceEvent[] = [];
  for (const item of outcomes) {
    summary.observed += item.observed;
    summary.blocked += item.blocked;
    summary.events += item.events;
    summary.errors += item.errors;
    allEvents.push(...item.createdEvents);
  }

  // Best-effort alerts — never fail the monitor batch.
  if (allEvents.length > 0) {
    try {
      await notifyWatchesForEvents(db, allEvents);
    } catch (error) {
      logger.warn("monitor.batch.notify", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  logger.info("monitor.batch", { status: "success", ...summary });
  return summary;
}
