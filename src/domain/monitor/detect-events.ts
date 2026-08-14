import type { Db } from "@/db";
import type { CourseObservation, CoursePriceEvent } from "@/db/schema";
import { listRecentOkObservations } from "@/db/repositories/observation-repository";
import {
  insertPriceEvent,
  listRecentEventsForCourse,
} from "@/db/repositories/price-event-repository";
import { updateCourse } from "@/db/repositories/course-repository";
import type { CertificateType, PriceType } from "@/domain/course/types";
import { isFreeLikePrice } from "@/domain/monitor/observe-course";
import { getServerEnv } from "@/lib/env";

export type PriceEventType =
  | "WENT_FREE"
  | "WENT_PAID"
  | "PRICE_CHANGED"
  | "CERT_CHANGED"
  | "DELISTED"
  | "RETURNED";

export type ObservationState = {
  id: string;
  priceType: PriceType | null;
  certificateType: CertificateType | null;
  observedRegion: string | null;
  observedAt: Date;
  fetchStatus: string;
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

function sameRegion(a: string | null, b: string | null): boolean {
  return a === b;
}

function isPaidLike(priceType: PriceType | null): boolean {
  return priceType === "PAID" || priceType === "FREE_TRIAL";
}

/**
 * Pure confirmation logic over 2–3 OK observations (newest-first input OK).
 * Requires the new state twice consecutively after a different prior state,
 * or the same from→to transition across consecutive pairs.
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

function toState(obs: CourseObservation): ObservationState {
  return {
    id: obs.id,
    priceType: obs.priceType,
    certificateType: obs.certificateType,
    observedRegion: obs.observedRegion,
    observedAt: obs.observedAt,
    fetchStatus: obs.fetchStatus,
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
      isPublic: false,
    });
    created.push(event);

    if (autoStatus) {
      if (
        transition.eventType === "WENT_FREE" ||
        transition.eventType === "WENT_PAID"
      ) {
        const priceType = transition.toState.priceType;
        if (typeof priceType === "string") {
          await updateCourse(db, courseId, {
            priceType: priceType as PriceType,
          });
        }
      }
      if (transition.eventType === "CERT_CHANGED") {
        const certificateType = transition.toState.certificateType;
        if (typeof certificateType === "string") {
          await updateCourse(db, courseId, {
            certificateType: certificateType as CertificateType,
          });
        }
      }
    }
  }

  return created;
}
