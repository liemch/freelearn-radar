/**
 * Runtime-wiring regression tests.
 *
 * PASS 1 found several features that existed as libraries with tests but had no
 * production caller. Unit tests cannot catch that class of defect, so these
 * assertions read the actual wiring artifacts — cron registration, flag usage,
 * scheduler hooks — and fail when a capability becomes orphaned again.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { queryDailyFreeDeals } from "@/domain/discovery/daily-free";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("P1-7 — every cron route must be registered with the scheduler", () => {
  const vercelConfig = JSON.parse(read("vercel.json")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  const scheduledPaths = new Set(
    (vercelConfig.crons ?? []).map((entry) => entry.path),
  );

  // A cron route that nothing invokes is a feature that cannot run in
  // production, which is exactly how coupon discovery came to be dead code.
  it.each([
    "/api/cron/discover",
    "/api/cron/verify",
    "/api/cron/monitor",
    "/api/cron/embed",
    "/api/cron/coupons",
  ])("%s has a schedule", (route) => {
    expect(scheduledPaths.has(route)).toBe(true);
  });

  it("gives every schedule a cron expression", () => {
    for (const entry of vercelConfig.crons ?? []) {
      expect(entry.schedule).toMatch(/^[\d*/,\-\s]+$/);
    }
  });

  // Hobby rejects any expression that fires more than once a day, and it
  // rejects it at deploy time — so an over-frequent schedule does not degrade
  // the cron, it takes the whole deployment down with it.
  it.each((vercelConfig.crons ?? []).map((entry) => entry.schedule))(
    "%s fires at most once per day",
    (schedule) => {
      const [minute, hour] = schedule.split(/\s+/);
      expect(countCronFields(minute)).toBe(1);
      expect(countCronFields(hour)).toBe(1);
    },
  );
});

/**
 * Number of distinct values a minute/hour cron field expands to. Anything
 * above one in either field means more than one fire per day.
 */
function countCronFields(field: string | undefined): number {
  if (field === undefined || field === "*") {
    return Number.POSITIVE_INFINITY;
  }

  return field.split(",").reduce((total, part) => {
    const [range, step] = part.split("/");
    if (step !== undefined) {
      return Number.POSITIVE_INFINITY;
    }
    const [start, end] = (range ?? "").split("-");
    if (end !== undefined) {
      return total + (Number(end) - Number(start) + 1);
    }
    return total + 1;
  }, 0);
}

describe("P1-6 — the media resolver must have a production caller", () => {
  it("is invoked from a cron route, not only from tests", () => {
    const cron = read("src/app/api/cron/coupons/route.ts");
    expect(cron).toContain("runMediaResolution");
  });

  it("is gated by its documented kill switch", () => {
    const runner = read("src/domain/media/media-resolution-runner.ts");
    expect(runner).toContain("FEATURE_MEDIA_RESOLVER");
  });

  it("persists the image_* columns the admin surface reads", () => {
    const runner = read("src/domain/media/media-resolution-runner.ts");
    for (const column of [
      "imageResolvedUrl",
      "imageSourceType",
      "imageStatus",
      "imageFallbackReason",
      "imageCheckedAt",
    ]) {
      expect(runner).toContain(column);
    }
  });

  it("runs even when coupon discovery is off, since media is independent", () => {
    const cron = read("src/app/api/cron/coupons/route.ts");
    const mediaCall = cron.indexOf("runMediaResolution(db)");
    const couponFlagCheck = cron.indexOf('FEATURE_COUPON_DISCOVERY !== "true"');
    expect(mediaCall).toBeGreaterThan(-1);
    expect(couponFlagCheck).toBeGreaterThan(-1);
    expect(mediaCall).toBeLessThan(couponFlagCheck);
  });
});

describe("P1-8 — hybrid search results must reach the rendered page", () => {
  const page = read("src/app/[locale]/search/page.tsx");

  it("hydrates courses from the fused ids instead of reordering the lexical slice", () => {
    expect(page).toContain("listEligibleCoursesByIds");
    expect(page).toContain("hybrid.courseIds");
  });

  it("no longer partitions the lexical page as its only use of fused ids", () => {
    // The pre-fix implementation discarded any fused id outside the 12-row
    // lexical page, which silently broke semantic rescue.
    expect(page).not.toContain("catalog.items.filter((c) => idSet.has(c.id))");
  });

  it("marks a request degraded when the semantic path was expected but absent", () => {
    expect(page).toContain("degraded = true");
  });
});

describe("P2-2 / P2-7 — SEO must follow the Vietnamese-only direction", () => {
  const sitemap = read("src/app/sitemap.ts");

  it("emits only the default locale", () => {
    expect(sitemap).toContain("defaultLocale");
    expect(sitemap).not.toMatch(/locales\.map/);
  });

  it("includes the daily-free surface", () => {
    expect(sitemap).toContain("/mien-phi-hom-nay");
  });
});

describe("P1-1 — expired offers must not reach the daily-free surface", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  function offerRow(overrides: {
    id: string;
    status: string;
    expiresAt: Date | null;
  }) {
    return {
      offer: {
        id: overrides.id,
        offerUrl: `https://udemy.com/course/${overrides.id}/?couponCode=X`,
        couponCode: "X",
        status: overrides.status,
        verifiedAt: new Date("2026-08-14T11:50:00Z"),
        expiresAt: overrides.expiresAt,
      },
      course: {
        id: `course-${overrides.id}`,
        slug: overrides.id,
        title: `Course ${overrides.id}`,
        status: "PUBLISHED",
        priceType: "FREE_WITH_COUPON",
        lastVerifiedAt: now,
        outboundUrl: "https://udemy.com/course/x/",
      },
      provider: { id: "p1", slug: "udemy", name: "Udemy" },
    };
  }

  /**
   * The repository already filters expiry in SQL. This exercises the domain
   * guard by handing it rows as if that filter had regressed, so both layers
   * are covered independently.
   */
  function fakeDb(rows: unknown[]) {
    const builder = {
      select: () => builder,
      from: () => builder,
      leftJoin: () => builder,
      innerJoin: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: async () => rows,
    };
    return builder as never;
  }

  it("drops an ACTIVE_100_OFF offer whose expiry has passed", async () => {
    const items = await queryDailyFreeDeals(
      fakeDb([
        offerRow({
          id: "expired",
          status: "ACTIVE_100_OFF",
          expiresAt: new Date("2026-08-13T00:00:00Z"),
        }),
      ]),
      { limit: 6, now },
    );

    expect(items.map((i) => i.course.slug)).not.toContain("expired");
  });

  it("does not readmit the same course through the unverified fallback", async () => {
    // The fallback ranks catalog rows, so an expired-coupon course would
    // otherwise reappear one branch later under a weaker label instead of
    // leaving the surface as §126.4 requires.
    const items = await queryDailyFreeDeals(
      fakeDb([
        offerRow({
          id: "expired",
          status: "ACTIVE_100_OFF",
          expiresAt: new Date("2026-08-13T00:00:00Z"),
        }),
      ]),
      { limit: 6, now },
    );

    expect(items).toEqual([]);
  });

  it("never emits a FREE_WITH_COUPON item, since none of them are verified", async () => {
    const items = await queryDailyFreeDeals(
      fakeDb([
        offerRow({ id: "a", status: "DISCOVERED", expiresAt: null }),
        offerRow({ id: "b", status: "EXPIRED", expiresAt: null }),
      ]),
      { limit: 6, now },
    );

    expect(items.map((i) => i.offerStatus)).not.toContain("FREE_WITH_COUPON");
  });

  it("keeps a live offer and marks it verified", async () => {
    const items = await queryDailyFreeDeals(
      fakeDb([
        offerRow({
          id: "live",
          status: "ACTIVE_100_OFF",
          expiresAt: new Date("2026-08-20T00:00:00Z"),
        }),
      ]),
      { limit: 1, now },
    );

    expect(items).toHaveLength(1);
    expect(items[0]!.couponVerified).toBe(true);
    expect(items[0]!.offerStatus).toBe("ACTIVE_100_OFF");
  });

  it("keeps an offer with no stated expiry", async () => {
    const items = await queryDailyFreeDeals(
      fakeDb([
        offerRow({ id: "no-expiry", status: "ACTIVE_100_OFF", expiresAt: null }),
      ]),
      { limit: 1, now },
    );

    expect(items).toHaveLength(1);
  });
});

describe("P1-3 — only a verified offer may claim the Coupon 100% badge", () => {
  const card = read("src/components/public/daily-free-card.tsx");

  it("requires couponVerified alongside ACTIVE_100_OFF", () => {
    expect(card).toContain('item.offerStatus === "ACTIVE_100_OFF" && item.couponVerified');
  });

  it("gives the unverified fallback its own weaker label", () => {
    expect(card).toContain("couponUnverified");
    expect(card).not.toMatch(
      /offerStatus === "ACTIVE_100_OFF" \|\| offerStatus === "FREE_WITH_COUPON"/,
    );
  });

  it("gates the coupon CTA on verification too", () => {
    expect(card).toContain("showCouponCta");
    const ctaLine = card
      .split("\n")
      .find((line) => line.includes("const showCouponCta"));
    expect(ctaLine ?? card).toBeTruthy();
    expect(card).toMatch(/showCouponCta =\s*\n?\s*item\.offerStatus === "ACTIVE_100_OFF" && item\.couponVerified/);
  });
});
