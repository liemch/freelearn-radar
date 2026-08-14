import type { Db } from "@/db";
import type { CourseObservation, CoursePriceEvent } from "@/db/schema";
import { listRecentOkObservations } from "@/db/repositories/observation-repository";
import {
  insertPriceEvent,
  listRecentEventsForCourse,
} from "@/db/repositories/price-event-repository";
import { findCourseById, updateCourse } from "@/db/repositories/course-repository";
import { writeAuditLog } from "@/domain/admin/audit-log";
import type { CertificateType, PriceType } from "@/domain/course/types";
import { isFreeLikePrice } from "@/domain/monitor/observe-course";
import { assertPriceTypeAllowed } from "@/domain/verification/provider-policy";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type PriceEventType =
  | "WENT_FREE"
  | "WENT_PAID"
  | "PRICE_CHANGED"
  | "CERT_CHANGED"
  | "DELISTED"
  | "RETURNED";

export type ExtractionMethod =
  | "JSON_LD"
  | "OG"
  | "HTML_META"
  | "PROVIDER_API"
  | "SEARCH"
  | "AI"
  | "MANUAL"
  | "POLICY";

export type ObservationState = {
  id: string;
  priceType: PriceType | null;
  certificateType: CertificateType | null;
  observedRegion: string | null;
  observedAt: Date;
  fetchStatus: string;
  extractionMethod: ExtractionMethod | null;
  confidence: number | null;
};

export type DetectedTransition = {
  eventType: PriceEventType;
  fromState: Record<string, unknown>;
  toState: Record<string, unknown>;
  confirmingObservationIds: string[];
  region: string | null;
  firstSeenAt: Date;
};

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * §69.3: confirming observations must be at least two hours apart. Without this,
 * a retry, a manual trigger, or a CDN cache flap produces three "consecutive"
 * observations minutes apart and a flash sale confirms as a real transition.
 */
const MIN_OBSERVATION_SPACING_MS = 2 * 60 * 60 * 1000;

/** Confidence floor for a non-deterministic observation to count (§69.3). */
const MIN_INFERRED_CONFIDENCE = 0.8;

/**
 * Page-derived or operator-derived extraction. SEARCH and AI are excluded: a
 * search snippet and a model answer are inferences about the page, not readings
 * of it, so each needs a confidence floor and a deterministic partner.
 */
const DETERMINISTIC_METHODS: ReadonlySet<ExtractionMethod> = new Set([
  "JSON_LD",
  "OG",
  "HTML_META",
  "PROVIDER_API",
  "MANUAL",
  "POLICY",
]);

/**
 * Auto-status may only follow the transitions §69.3 lists. CERT_CHANGED is
 * deliberately absent — a certificate flip goes to a human, not to the course row.
 */
const AUTO_STATUS_EVENT_TYPES: ReadonlySet<PriceEventType> = new Set([
  "WENT_FREE",
  "WENT_PAID",
]);

/** Event types a visitor can act on; others stay internal until reviewed. */
const PUBLISHABLE_EVENT_TYPES: ReadonlySet<PriceEventType> = new Set([
  "WENT_FREE",
  "WENT_PAID",
  "DELISTED",
  "RETURNED",
]);

/**
 * An unknown region cannot be compared with anything, including another unknown
 * region: two nulls may be two different countries. Treating null as a match made
 * the guard pass vacuously for every production observation.
 */
function sameRegion(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b;
}

function isDeterministic(obs: ObservationState): boolean {
  return obs.extractionMethod != null &&
    DETERMINISTIC_METHODS.has(obs.extractionMethod);
}

/**
 * §69.3 evidence rule: every observation must be either deterministic or a
 * high-confidence inference, and at least one must be deterministic.
 */
function hasSufficientEvidence(observations: ObservationState[]): boolean {
  let deterministicCount = 0;

  for (const obs of observations) {
    if (isDeterministic(obs)) {
      deterministicCount += 1;
      continue;
    }
    if ((obs.confidence ?? 0) < MIN_INFERRED_CONFIDENCE) {
      return false;
    }
  }

  return deterministicCount >= 1;
}

/** Consecutive observations must be spaced far enough apart to be independent. */
function isAdequatelySpaced(orderedOldestFirst: ObservationState[]): boolean {
  for (let index = 1; index < orderedOldestFirst.length; index += 1) {
    const previous = orderedOldestFirst[index - 1]!;
    const current = orderedOldestFirst[index]!;
    const gap = current.observedAt.getTime() - previous.observedAt.getTime();
    if (gap < MIN_OBSERVATION_SPACING_MS) {
      return false;
    }
  }
  return true;
}

function isPaidLike(priceType: PriceType | null): boolean {
  return priceType === "PAID" || priceType === "FREE_TRIAL";
}

/**
 * Pure confirmation logic over 2–3 OK observations (newest-first input OK).
 * Requires the new state twice consecutively after a different prior state,
 * or the same from→to transition across consecutive pairs.
 *
 * All four §69.3 conditions are applied here: count, spacing, region, evidence.
 */
export function confirmTransitionsFromObservations(
  observationsNewestFirst: ObservationState[],
): DetectedTransition[] {
  const usable = observationsNewestFirst
    .filter((obs) => obs.fetchStatus === "OK")
    .slice(0, 3);

  if (usable.length < 2) {
    return [];
  }

  // Work oldest → newest within the window
  const ordered = [...usable].reverse();
  const region = ordered[ordered.length - 1]?.observedRegion ?? null;

  for (const obs of ordered) {
    if (!sameRegion(obs.observedRegion, region)) {
      return [];
    }
  }

  if (!isAdequatelySpaced(ordered)) {
    return [];
  }

  if (!hasSufficientEvidence(ordered)) {
    return [];
  }

  const confirmed: DetectedTransition[] = [];

  // Pattern A: baseline + two consecutive agreeing new states (needs 3)
  if (ordered.length >= 3) {
    const [older, mid, newer] = ordered as [
      ObservationState,
      ObservationState,
      ObservationState,
    ];

    const priceTransition = detectPriceTransition(older, mid, newer);
    if (priceTransition) confirmed.push(priceTransition);

    const certTransition = detectCertTransition(older, mid, newer);
    if (certTransition) confirmed.push(certTransition);
  }

  // Pattern B: same transition seen on consecutive pairs (obs0→obs1 and obs1→obs2)
  if (ordered.length >= 3) {
    const [a, b, c] = ordered as [
      ObservationState,
      ObservationState,
      ObservationState,
    ];
    const t1 = pairPriceTransition(a, b);
    const t2 = pairPriceTransition(b, c);
    if (
      t1 &&
      t2 &&
      t1.eventType === t2.eventType &&
      !confirmed.some((item) => item.eventType === t1.eventType)
    ) {
      confirmed.push({
        eventType: t1.eventType,
        fromState: t1.fromState,
        toState: t2.toState,
        confirmingObservationIds: [a.id, b.id, c.id],
        region,
        firstSeenAt: b.observedAt,
      });
    }
  }

  return confirmed;
}

function pairPriceTransition(
  from: ObservationState,
  to: ObservationState,
): Omit<DetectedTransition, "confirmingObservationIds" | "region" | "firstSeenAt"> | null {
  if (!from.priceType || !to.priceType || from.priceType === to.priceType) {
    return null;
  }

  if (isPaidLike(from.priceType) && isFreeLikePrice(to.priceType)) {
    return {
      eventType: "WENT_FREE",
      fromState: { priceType: from.priceType },
      toState: { priceType: to.priceType },
    };
  }

  if (isFreeLikePrice(from.priceType) && isPaidLike(to.priceType)) {
    return {
      eventType: "WENT_PAID",
      fromState: { priceType: from.priceType },
      toState: { priceType: to.priceType },
    };
  }

  return null;
}

function detectPriceTransition(
  older: ObservationState,
  mid: ObservationState,
  newer: ObservationState,
): DetectedTransition | null {
  if (
    !older.priceType ||
    !mid.priceType ||
    !newer.priceType ||
    mid.priceType !== newer.priceType ||
    older.priceType === mid.priceType
  ) {
    return null;
  }

  let eventType: PriceEventType | null = null;
  if (isPaidLike(older.priceType) && isFreeLikePrice(mid.priceType)) {
    eventType = "WENT_FREE";
  } else if (isFreeLikePrice(older.priceType) && isPaidLike(mid.priceType)) {
    eventType = "WENT_PAID";
  }

  if (!eventType) return null;

  return {
    eventType,
    fromState: { priceType: older.priceType },
    toState: { priceType: mid.priceType },
    confirmingObservationIds: [older.id, mid.id, newer.id],
    region: newer.observedRegion,
    firstSeenAt: mid.observedAt,
  };
}

function detectCertTransition(
  older: ObservationState,
  mid: ObservationState,
  newer: ObservationState,
): DetectedTransition | null {
  if (
    !older.certificateType ||
    !mid.certificateType ||
    !newer.certificateType ||
    mid.certificateType !== newer.certificateType ||
    older.certificateType === mid.certificateType
  ) {
    return null;
  }

  return {
    eventType: "CERT_CHANGED",
    fromState: { certificateType: older.certificateType },
    toState: { certificateType: mid.certificateType },
    confirmingObservationIds: [older.id, mid.id, newer.id],
    region: newer.observedRegion,
    firstSeenAt: mid.observedAt,
  };
}

/** Drizzle returns `numeric` columns as strings. */
function toConfidence(raw: string | null): number | null {
  if (raw == null) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toState(obs: CourseObservation): ObservationState {
  return {
    id: obs.id,
    priceType: obs.priceType,
    certificateType: obs.certificateType,
    observedRegion: obs.observedRegion,
    observedAt: obs.observedAt,
    fetchStatus: obs.fetchStatus,
    extractionMethod: obs.extractionMethod,
    confidence: toConfidence(obs.confidence),
  };
}

function withinCooldown(
  recent: CoursePriceEvent[],
  eventType: PriceEventType,
  now: Date,
): boolean {
  return recent.some(
    (event) =>
      event.eventType === eventType &&
      event.confirmedAt != null &&
      now.getTime() - event.confirmedAt.getTime() < COOLDOWN_MS,
  );
}

/**
 * Compare last 2–3 OK observations and persist confirmed price events.
 * Never invents events from BLOCKED/TIMEOUT/ERROR rows.
 */
export async function detectPriceEvents(
  db: Db,
  courseId: string,
  options?: { now?: Date; autoStatus?: boolean },
): Promise<CoursePriceEvent[]> {
  const now = options?.now ?? new Date();
  const env = getServerEnv();
  const autoStatus =
    options?.autoStatus ?? env.FEATURE_AUTO_STATUS === "true";

  const recentOk = await listRecentOkObservations(db, courseId, 3);
  // Guard: never feed non-OK (repository already filters)
  if (recentOk.some((obs) => obs.fetchStatus !== "OK")) {
    return [];
  }

  const transitions = confirmTransitionsFromObservations(
    recentOk.map(toState),
  );
  if (transitions.length === 0) {
    return [];
  }

  const course = await findCourseById(db, courseId);
  const recentEvents = await listRecentEventsForCourse(db, courseId, 20);
  const created: CoursePriceEvent[] = [];

  for (const transition of transitions) {
    if (withinCooldown(recentEvents, transition.eventType, now)) {
      continue;
    }

    const already = recentEvents.some(
      (event) =>
        event.eventType === transition.eventType &&
        JSON.stringify(event.fromState) ===
          JSON.stringify(transition.fromState) &&
        JSON.stringify(event.toState) === JSON.stringify(transition.toState) &&
        event.confirmedAt != null &&
        now.getTime() - event.confirmedAt.getTime() < COOLDOWN_MS,
    );
    if (already) continue;

    const event = await insertPriceEvent(db, {
      courseId,
      eventType: transition.eventType,
      fromState: transition.fromState,
      toState: transition.toState,
      firstSeenAt: transition.firstSeenAt,
      confirmedAt: now,
      confirmingObservationIds: transition.confirmingObservationIds,
      region: transition.region,
      // A confirmed event on a live course is what the tracker exists to show.
      // Unpublished courses keep their events internal.
      isPublic:
        course?.status === "PUBLISHED" &&
        PUBLISHABLE_EVENT_TYPES.has(transition.eventType),
    });

    // The unique index rejected a concurrent duplicate; another run already
    // recorded this transition.
    if (!event) continue;

    created.push(event);

    await writeAuditLog(db, {
      actorType: "WORKER",
      actorId: env.MONITOR_WORKER_VERSION,
      action: "PRICE_EVENT_DETECTED",
      entityType: "course_price_event",
      entityId: event.id,
      after: {
        courseId,
        eventType: transition.eventType,
        fromState: transition.fromState,
        toState: transition.toState,
        region: transition.region,
        confirmingObservationIds: transition.confirmingObservationIds,
      },
    });

    if (autoStatus && AUTO_STATUS_EVENT_TYPES.has(transition.eventType)) {
      await applyAutoStatus(db, courseId, transition, course?.priceType ?? null, env);
    }
  }

  return created;
}

async function applyAutoStatus(
  db: Db,
  courseId: string,
  transition: DetectedTransition,
  previousPriceType: PriceType | null,
  env: ReturnType<typeof getServerEnv>,
): Promise<void> {
  const priceType = transition.toState.priceType;
  if (typeof priceType !== "string") return;

  try {
    // Observation evidence is a SEARCH-grade source; FREE_WITH_COUPON stays
    // MANUAL-only (§65.4) no matter how the page is worded.
    assertPriceTypeAllowed("SEARCH", priceType as PriceType);
  } catch {
    logger.warn("monitor.auto_status.blocked", {
      courseId,
      priceType,
      reason: "price type not allowed from an automated source",
    });
    return;
  }

  await updateCourse(db, courseId, { priceType: priceType as PriceType });

  await writeAuditLog(db, {
    actorType: "WORKER",
    actorId: env.MONITOR_WORKER_VERSION,
    action: "COURSE_AUTO_STATUS",
    entityType: "course",
    entityId: courseId,
    before: { priceType: previousPriceType },
    after: { priceType },
    reason: `auto-status from confirmed ${transition.eventType}`,
  });
}
