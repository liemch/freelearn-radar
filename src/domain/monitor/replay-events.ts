import { and, asc, gte } from "drizzle-orm";

import type { Db } from "@/db";
import { courseObservations, type CourseObservation } from "@/db/schema";
import {
  confirmTransitionsFromObservations,
  type DetectedTransition,
  type ExtractionMethod,
  type ObservationState,
} from "@/domain/monitor/detect-events";

export type ReplayedEvent = {
  courseId: string;
  eventType: DetectedTransition["eventType"];
  fromState: Record<string, unknown>;
  toState: Record<string, unknown>;
  region: string | null;
  confirmedAt: Date;
  confirmingObservationIds: string[];
};

export type ReplaySummary = {
  windowDays: number;
  coursesWithHistory: number;
  observationsRead: number;
  observationsUsable: number;
  observationsMissingRegion: number;
  windowsEvaluated: number;
  events: ReplayedEvent[];
  eventsByType: Record<string, number>;
  /** Same course + type confirmed more than once inside the 24h cooldown. */
  suspectedDuplicates: number;
};

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function toState(obs: CourseObservation): ObservationState {
  const confidence =
    obs.confidence == null ? null : Number.parseFloat(obs.confidence);

  return {
    id: obs.id,
    priceType: obs.priceType,
    certificateType: obs.certificateType,
    observedRegion: obs.observedRegion,
    observedAt: obs.observedAt,
    fetchStatus: obs.fetchStatus,
    extractionMethod: obs.extractionMethod as ExtractionMethod | null,
    confidence: Number.isFinite(confidence) ? confidence : null,
  };
}

/**
 * Re-runs confirmation over stored history without writing anything, so the
 * §73 STOP 3 gate ("replay 30 days of real data, expect zero false events") can
 * be evidenced rather than asserted.
 *
 * This deliberately uses the same pure function the worker uses. A replay that
 * reimplemented the rules would prove nothing about production behaviour.
 */
export async function replayEvents(
  db: Db,
  options: { windowDays?: number; now?: Date } = {},
): Promise<ReplaySummary> {
  const windowDays = options.windowDays ?? 30;
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(courseObservations)
    .where(and(gte(courseObservations.observedAt, since)))
    .orderBy(asc(courseObservations.courseId), asc(courseObservations.observedAt));

  const byCourse = new Map<string, CourseObservation[]>();
  for (const row of rows) {
    const list = byCourse.get(row.courseId);
    if (list) list.push(row);
    else byCourse.set(row.courseId, [row]);
  }

  const summary: ReplaySummary = {
    windowDays,
    coursesWithHistory: byCourse.size,
    observationsRead: rows.length,
    observationsUsable: rows.filter((row) => row.fetchStatus === "OK").length,
    observationsMissingRegion: rows.filter((row) => !row.observedRegion).length,
    windowsEvaluated: 0,
    events: [],
    eventsByType: {},
    suspectedDuplicates: 0,
  };

  for (const [courseId, observations] of byCourse) {
    const usable = observations.filter((obs) => obs.fetchStatus === "OK");
    const lastConfirmed = new Map<string, number>();

    // Slide the same three-observation window the worker sees on each run.
    for (let end = 2; end < usable.length; end += 1) {
      const window = [usable[end - 2]!, usable[end - 1]!, usable[end]!];
      summary.windowsEvaluated += 1;

      const transitions = confirmTransitionsFromObservations(
        window.map(toState).reverse(),
      );

      for (const transition of transitions) {
        const confirmedAt = window[2]!.observedAt;
        const previous = lastConfirmed.get(transition.eventType);

        if (
          previous != null &&
          confirmedAt.getTime() - previous < COOLDOWN_MS
        ) {
          summary.suspectedDuplicates += 1;
          continue;
        }

        lastConfirmed.set(transition.eventType, confirmedAt.getTime());
        summary.eventsByType[transition.eventType] =
          (summary.eventsByType[transition.eventType] ?? 0) + 1;

        summary.events.push({
          courseId,
          eventType: transition.eventType,
          fromState: transition.fromState,
          toState: transition.toState,
          region: transition.region,
          confirmedAt,
          confirmingObservationIds: transition.confirmingObservationIds,
        });
      }
    }
  }

  return summary;
}
