import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmTransitionsFromObservations,
  type ObservationState,
} from "@/domain/monitor/detect-events";

function obs(
  partial: Partial<ObservationState> & Pick<ObservationState, "id">,
): ObservationState {
  return {
    priceType: null,
    certificateType: null,
    observedRegion: "US",
    observedAt: new Date("2026-08-01T12:00:00Z"),
    fetchStatus: "OK",
    ...partial,
  };
}

describe("confirmTransitionsFromObservations", () => {
  it("confirms WENT_FREE when paid → free is seen on two consecutive OK observations", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({
        id: "o3",
        priceType: "FREE_FULL",
        observedAt: new Date("2026-08-01T18:00:00Z"),
      }),
      obs({
        id: "o2",
        priceType: "FREE_FULL",
        observedAt: new Date("2026-08-01T12:00:00Z"),
      }),
      obs({
        id: "o1",
        priceType: "PAID",
        observedAt: new Date("2026-08-01T06:00:00Z"),
      }),
    ]);

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
    const transitions = confirmTransitionsFromObservations([
      obs({ id: "n", priceType: "PAID" }),
      obs({ id: "m", priceType: "PAID" }),
      obs({ id: "o", priceType: "FREE_AUDIT" }),
    ]);

    expect(transitions.some((t) => t.eventType === "WENT_PAID")).toBe(true);
  });

  it("confirms CERT_CHANGED when certificate flips and stays", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({
        id: "n",
        priceType: "FREE_FULL",
        certificateType: "PAID_CERTIFICATE",
      }),
      obs({
        id: "m",
        priceType: "FREE_FULL",
        certificateType: "PAID_CERTIFICATE",
      }),
      obs({
        id: "o",
        priceType: "FREE_FULL",
        certificateType: "FREE_CERTIFICATE",
      }),
    ]);

    expect(transitions.some((t) => t.eventType === "CERT_CHANGED")).toBe(true);
  });

  it("does not confirm from a single unpaired transition (flapping)", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({ id: "n", priceType: "FREE_FULL" }),
      obs({ id: "o", priceType: "PAID" }),
    ]);
    expect(transitions).toEqual([]);
  });

  it("never compares across different observed_region", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({ id: "n", priceType: "FREE_FULL", observedRegion: "US" }),
      obs({ id: "m", priceType: "FREE_FULL", observedRegion: "EU" }),
      obs({ id: "o", priceType: "PAID", observedRegion: "US" }),
    ]);
    expect(transitions).toEqual([]);
  });

  it("ignores non-OK fetch statuses in the window", () => {
    const transitions = confirmTransitionsFromObservations([
      obs({ id: "n", priceType: "FREE_FULL", fetchStatus: "BLOCKED" }),
      obs({ id: "m", priceType: "FREE_FULL" }),
      obs({ id: "o", priceType: "PAID" }),
    ]);
    expect(transitions).toEqual([]);
  });
});

describe("detectPriceEvents persistence guards", () => {
  const listRecentOkObservations = vi.fn();
  const insertPriceEvent = vi.fn();
  const listRecentEventsForCourse = vi.fn();
  const updateCourse = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      "postgresql://user:pass@localhost:5432/test";
    process.env.FEATURE_AUTO_STATUS = "";
  });

  it("does not insert events when only empty OK history is available", async () => {
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
    }));

    listRecentOkObservations.mockResolvedValue([]);
    listRecentEventsForCourse.mockResolvedValue([]);

    const { detectPriceEvents } = await import(
      "@/domain/monitor/detect-events"
    );
    const created = await detectPriceEvents({} as never, "course-1");

    expect(created).toEqual([]);
    expect(insertPriceEvent).not.toHaveBeenCalled();
  });
});
