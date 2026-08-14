import { describe, expect, it } from "vitest";

import { replayEvents } from "@/domain/monitor/replay-events";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-14T00:00:00Z");

type Row = Record<string, unknown>;

function observation(overrides: Row): Row {
  return {
    id: "obs",
    courseId: "course-1",
    observedAt: new Date(NOW.getTime() - DAY),
    fetchStatus: "OK",
    priceType: "PAID",
    certificateType: null,
    observedRegion: "US",
    extractionMethod: "JSON_LD",
    confidence: "0.950",
    ...overrides,
  };
}

/**
 * Minimal stand-in for the Drizzle chain replayEvents uses. The rows it returns
 * are what a real query would return, so the confirmation rules under test are
 * the production ones.
 */
function fakeDb(rows: Row[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: async () => rows,
  };
  return { select: () => chain } as never;
}

describe("replayEvents", () => {
  it("reports a genuine transition without writing anything", async () => {
    const rows = [
      observation({
        id: "o1",
        priceType: "PAID",
        observedAt: new Date(NOW.getTime() - 3 * DAY),
      }),
      observation({
        id: "o2",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - 2 * DAY),
      }),
      observation({
        id: "o3",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - DAY),
      }),
    ];

    const summary = await replayEvents(fakeDb(rows), { now: NOW });

    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]?.eventType).toBe("WENT_FREE");
    expect(summary.eventsByType.WENT_FREE).toBe(1);
    expect(summary.coursesWithHistory).toBe(1);
  });

  it("produces no events from history with no region stamp", async () => {
    const rows = [
      observation({
        id: "o1",
        priceType: "PAID",
        observedRegion: null,
        observedAt: new Date(NOW.getTime() - 3 * DAY),
      }),
      observation({
        id: "o2",
        priceType: "FREE_FULL",
        observedRegion: null,
        observedAt: new Date(NOW.getTime() - 2 * DAY),
      }),
      observation({
        id: "o3",
        priceType: "FREE_FULL",
        observedRegion: null,
        observedAt: new Date(NOW.getTime() - DAY),
      }),
    ];

    const summary = await replayEvents(fakeDb(rows), { now: NOW });

    expect(summary.events).toEqual([]);
    expect(summary.observationsMissingRegion).toBe(3);
  });

  it("does not treat a blocked fetch as a price change", async () => {
    const rows = [
      observation({
        id: "o1",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - 3 * DAY),
      }),
      observation({
        id: "o2",
        fetchStatus: "BLOCKED",
        priceType: null,
        observedAt: new Date(NOW.getTime() - 2 * DAY),
      }),
      observation({
        id: "o3",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - DAY),
      }),
    ];

    const summary = await replayEvents(fakeDb(rows), { now: NOW });

    expect(summary.events).toEqual([]);
    expect(summary.observationsUsable).toBe(2);
  });

  it("counts a repeat inside the cooldown as a duplicate rather than an event", async () => {
    const rows = [
      observation({
        id: "o1",
        priceType: "PAID",
        observedAt: new Date(NOW.getTime() - 5 * DAY),
      }),
      observation({
        id: "o2",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - 4 * DAY),
      }),
      observation({
        id: "o3",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - 4 * DAY + 3 * 60 * 60 * 1000),
      }),
      observation({
        id: "o4",
        priceType: "FREE_FULL",
        observedAt: new Date(NOW.getTime() - 4 * DAY + 6 * 60 * 60 * 1000),
      }),
    ];

    const summary = await replayEvents(fakeDb(rows), { now: NOW });

    expect(summary.events).toHaveLength(1);
    expect(summary.windowsEvaluated).toBe(2);
  });
});
