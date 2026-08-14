import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmTransitionsFromObservations,
  type ObservationState,
} from "@/domain/monitor/detect-events";

const BASE_TIME = new Date("2026-08-01T06:00:00Z").getTime();
const SIX_HOURS = 6 * 60 * 60 * 1000;

function obs(
  partial: Partial<ObservationState> & Pick<ObservationState, "id">,
): ObservationState {
  return {
    priceType: null,
    certificateType: null,
    observedRegion: "US",
    observedAt: new Date(BASE_TIME),
    fetchStatus: "OK",
    extractionMethod: "JSON_LD",
    confidence: 0.95,
    ...partial,
  };
}

/**
 * Newest-first, spaced six hours apart — the shape a healthy daily monitor
 * produces. Callers pass states oldest-first for readability.
 */
function spacedWindow(
  states: Array<Partial<ObservationState> & Pick<ObservationState, "id">>,
): ObservationState[] {
  return states
    .map((state, index) =>
      obs({ ...state, observedAt: new Date(BASE_TIME + index * SIX_HOURS) }),
    )
    .reverse();
}

describe("confirmTransitionsFromObservations", () => {
  it("confirms WENT_FREE when paid → free is seen on two consecutive OK observations", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o1", priceType: "PAID" },
        { id: "o2", priceType: "FREE_FULL" },
        { id: "o3", priceType: "FREE_FULL" },
      ]),
    );

    expect(transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "WENT_FREE",
          fromState: { priceType: "PAID" },
          toState: { priceType: "FREE_FULL" },
        }),
      ]),
    );
  });

  it("confirms WENT_PAID for free → paid with two agreeing observations", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "FREE_AUDIT" },
        { id: "m", priceType: "PAID" },
        { id: "n", priceType: "PAID" },
      ]),
    );

    expect(transitions.some((t) => t.eventType === "WENT_PAID")).toBe(true);
  });

  it("confirms CERT_CHANGED when certificate flips and stays", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        {
          id: "o",
          priceType: "FREE_FULL",
          certificateType: "FREE_CERTIFICATE",
        },
        {
          id: "m",
          priceType: "FREE_FULL",
          certificateType: "PAID_CERTIFICATE",
        },
        {
          id: "n",
          priceType: "FREE_FULL",
          certificateType: "PAID_CERTIFICATE",
        },
      ]),
    );

    expect(transitions.some((t) => t.eventType === "CERT_CHANGED")).toBe(true);
  });

  it("does not confirm from a single unpaired transition (flapping)", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID" },
        { id: "n", priceType: "FREE_FULL" },
      ]),
    );
    expect(transitions).toEqual([]);
  });

  it("never compares across different observed_region", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", observedRegion: "US" },
        { id: "m", priceType: "FREE_FULL", observedRegion: "EU" },
        { id: "n", priceType: "FREE_FULL", observedRegion: "US" },
      ]),
    );
    expect(transitions).toEqual([]);
  });

  it("ignores non-OK fetch statuses in the window", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID" },
        { id: "m", priceType: "FREE_FULL" },
        { id: "n", priceType: "FREE_FULL", fetchStatus: "BLOCKED" },
      ]),
    );
    expect(transitions).toEqual([]);
  });
});

// EVT-02 regression: production never stamped a region, and sameRegion compared
// null === null as a match, so the region guard passed for every observation.
describe("region guard with unstamped observations", () => {
  it("refuses to confirm when the region is unknown", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", observedRegion: null },
        { id: "m", priceType: "FREE_FULL", observedRegion: null },
        { id: "n", priceType: "FREE_FULL", observedRegion: null },
      ]),
    );
    expect(transitions).toEqual([]);
  });

  it("refuses when only the newest observation carries a region", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", observedRegion: null },
        { id: "m", priceType: "FREE_FULL", observedRegion: null },
        { id: "n", priceType: "FREE_FULL", observedRegion: "US" },
      ]),
    );
    expect(transitions).toEqual([]);
  });
});

// EVT-01 regression: §69.3 requires ≥2h spacing, which was never checked, so a
// retry or a CDN flap could confirm a transition from three near-identical reads.
describe("observation spacing", () => {
  it("refuses observations taken minutes apart", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({
        id: "n",
        priceType: "FREE_FULL",
        observedAt: new Date(BASE_TIME + 10 * 60 * 1000),
      }),
      obs({
        id: "m",
        priceType: "FREE_FULL",
        observedAt: new Date(BASE_TIME + 5 * 60 * 1000),
      }),
      obs({ id: "o", priceType: "PAID", observedAt: new Date(BASE_TIME) }),
    ]);

    expect(transitions).toEqual([]);
  });

  it("accepts observations exactly two hours apart", () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const transitions = confirmTransitionsFromObservations([
      obs({
        id: "n",
        priceType: "FREE_FULL",
        observedAt: new Date(BASE_TIME + 2 * twoHours),
      }),
      obs({
        id: "m",
        priceType: "FREE_FULL",
        observedAt: new Date(BASE_TIME + twoHours),
      }),
      obs({ id: "o", priceType: "PAID", observedAt: new Date(BASE_TIME) }),
    ]);

    expect(transitions.some((t) => t.eventType === "WENT_FREE")).toBe(true);
  });
});

// EVT-01 regression: extraction method and confidence were never carried into
// the confirmation input, so a low-confidence guess counted as hard evidence.
describe("evidence quality", () => {
  it("refuses a window built entirely from low-confidence inference", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", extractionMethod: "AI", confidence: 0.4 },
        {
          id: "m",
          priceType: "FREE_FULL",
          extractionMethod: "AI",
          confidence: 0.4,
        },
        {
          id: "n",
          priceType: "FREE_FULL",
          extractionMethod: "AI",
          confidence: 0.4,
        },
      ]),
    );

    expect(transitions).toEqual([]);
  });

  it("refuses when no observation is deterministic, however confident", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", extractionMethod: "AI", confidence: 0.99 },
        {
          id: "m",
          priceType: "FREE_FULL",
          extractionMethod: "AI",
          confidence: 0.99,
        },
        {
          id: "n",
          priceType: "FREE_FULL",
          extractionMethod: "AI",
          confidence: 0.99,
        },
      ]),
    );

    expect(transitions).toEqual([]);
  });

  it("accepts one deterministic reading alongside a high-confidence inference", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        { id: "o", priceType: "PAID", extractionMethod: "JSON_LD" },
        {
          id: "m",
          priceType: "FREE_FULL",
          extractionMethod: "AI",
          confidence: 0.9,
        },
        { id: "n", priceType: "FREE_FULL", extractionMethod: "JSON_LD" },
      ]),
    );

    expect(transitions.some((t) => t.eventType === "WENT_FREE")).toBe(true);
  });

  it("treats a search snippet as inference, not a page reading", () => {
    const transitions = confirmTransitionsFromObservations(
      spacedWindow([
        {
          id: "o",
          priceType: "PAID",
          extractionMethod: "SEARCH",
          confidence: 0.5,
        },
        {
          id: "m",
          priceType: "FREE_FULL",
          extractionMethod: "SEARCH",
          confidence: 0.5,
        },
        {
          id: "n",
          priceType: "FREE_FULL",
          extractionMethod: "SEARCH",
          confidence: 0.5,
        },
      ]),
    );

    expect(transitions).toEqual([]);
  });
});

describe("detectPriceEvents persistence guards", () => {
  const listRecentOkObservations = vi.fn();
  const insertPriceEvent = vi.fn();
  const listRecentEventsForCourse = vi.fn();
  const updateCourse = vi.fn();
  const findCourseById = vi.fn();
  const writeAuditLog = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgresql://user:pass@localhost:5432/test";
    process.env.FEATURE_AUTO_STATUS = "";
  });

  function mockRepositories() {
    vi.doMock("@/db/repositories/observation-repository", () => ({
      listRecentOkObservations: (...args: unknown[]) =>
        listRecentOkObservations(...args),
    }));
    vi.doMock("@/db/repositories/price-event-repository", () => ({
      insertPriceEvent: (...args: unknown[]) => insertPriceEvent(...args),
      listRecentEventsForCourse: (...args: unknown[]) =>
        listRecentEventsForCourse(...args),
    }));
    vi.doMock("@/db/repositories/course-repository", () => ({
      updateCourse: (...args: unknown[]) => updateCourse(...args),
      findCourseById: (...args: unknown[]) => findCourseById(...args),
    }));
    vi.doMock("@/domain/admin/audit-log", () => ({
      writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
    }));
  }

  it("does not insert events when only empty OK history is available", async () => {
    mockRepositories();

    listRecentOkObservations.mockResolvedValue([]);
    listRecentEventsForCourse.mockResolvedValue([]);

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    const created = await detectPriceEvents({} as never, "course-1");

    expect(created).toEqual([]);
    expect(insertPriceEvent).not.toHaveBeenCalled();
  });

  // DAT-01 regression: the unique index is the real guarantee, so the caller
  // must cope with a rejected insert rather than assuming a row came back.
  it("treats a rejected duplicate insert as no event", async () => {
    mockRepositories();

    const window = [
      { id: "n", priceType: "FREE_FULL" },
      { id: "m", priceType: "FREE_FULL" },
      { id: "o", priceType: "PAID" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({ id: "course-1", status: "PUBLISHED" });
    insertPriceEvent.mockResolvedValue(null);

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    const created = await detectPriceEvents({} as never, "course-1");

    expect(insertPriceEvent).toHaveBeenCalled();
    expect(created).toEqual([]);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  // MON-01 regression: worker-driven state changes were invisible in the audit log.
  it("audits every event it records", async () => {
    mockRepositories();

    const window = [
      { id: "n", priceType: "FREE_FULL" },
      { id: "m", priceType: "FREE_FULL" },
      { id: "o", priceType: "PAID" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({ id: "course-1", status: "PUBLISHED" });
    insertPriceEvent.mockResolvedValue({ id: "event-1" });

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    await detectPriceEvents({} as never, "course-1");

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorType: "WORKER",
        action: "PRICE_EVENT_DETECTED",
        entityType: "course_price_event",
      }),
    );
  });

  // TRK-01 regression: isPublic was hardcoded false, so the tracker was empty.
  it("publishes a confirmed event on a published course", async () => {
    mockRepositories();

    const window = [
      { id: "n", priceType: "FREE_FULL" },
      { id: "m", priceType: "FREE_FULL" },
      { id: "o", priceType: "PAID" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({ id: "course-1", status: "PUBLISHED" });
    insertPriceEvent.mockResolvedValue({ id: "event-1" });

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    await detectPriceEvents({} as never, "course-1");

    expect(insertPriceEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isPublic: true }),
    );
  });

  it("keeps events internal for a course that is not published", async () => {
    mockRepositories();

    const window = [
      { id: "n", priceType: "FREE_FULL" },
      { id: "m", priceType: "FREE_FULL" },
      { id: "o", priceType: "PAID" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({ id: "course-1", status: "DRAFT" });
    insertPriceEvent.mockResolvedValue({ id: "event-1" });

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    await detectPriceEvents({} as never, "course-1");

    expect(insertPriceEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isPublic: false }),
    );
  });

  // TRU-04 regression: auto-status wrote toState.priceType directly, so coupon
  // wording on a page could set a value §65.4 reserves for manual entry.
  it("refuses to auto-write FREE_WITH_COUPON", async () => {
    mockRepositories();

    const window = [
      { id: "n", priceType: "FREE_WITH_COUPON" },
      { id: "m", priceType: "FREE_WITH_COUPON" },
      { id: "o", priceType: "PAID" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({
      id: "course-1",
      status: "PUBLISHED",
      priceType: "PAID",
    });
    insertPriceEvent.mockResolvedValue({ id: "event-1" });

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    await detectPriceEvents({} as never, "course-1", { autoStatus: true });

    expect(updateCourse).not.toHaveBeenCalled();
  });

  // EVT-04 regression: CERT_CHANGED auto-updated the course, which is outside
  // the transitions §69.3 permits.
  it("does not auto-update the course on a certificate change", async () => {
    mockRepositories();

    const window = [
      { id: "n", certificateType: "PAID_CERTIFICATE", priceType: "FREE_FULL" },
      { id: "m", certificateType: "PAID_CERTIFICATE", priceType: "FREE_FULL" },
      { id: "o", certificateType: "FREE_CERTIFICATE", priceType: "FREE_FULL" },
    ].map((state, index) => ({
      ...obs({ ...state, id: state.id } as never),
      observedAt: new Date(BASE_TIME + (2 - index) * SIX_HOURS),
    }));

    listRecentOkObservations.mockResolvedValue(window);
    listRecentEventsForCourse.mockResolvedValue([]);
    findCourseById.mockResolvedValue({ id: "course-1", status: "PUBLISHED" });
    insertPriceEvent.mockResolvedValue({ id: "event-1" });

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    await detectPriceEvents({} as never, "course-1", { autoStatus: true });

    expect(updateCourse).not.toHaveBeenCalled();
  });
});
