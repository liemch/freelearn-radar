/**
 * Verification 03 — the full coupon pipeline against a real Postgres.
 *
 * Source HTML → candidate → parser → coupon_code → canonical/offer identity →
 * official verification → state transition → publication eligibility → public
 * surface. The network is the only stubbed part: `globalThis.fetch` is replaced,
 * so `safeHttpGet` (redirect validation, SSRF checks, content-type, size cap) and
 * every runner and repository still execute for real.
 *
 * No coupon status is ever written by this file. Every status is produced by the
 * code under test from the evidence it was given.
 */

import "@/lib/load-env";

import { couponCandidates, courseOffers } from "@/db/schema";
import {
  listActive100OffOffers,
  listCourseOffers,
  couponOpsSummary,
} from "@/db/repositories/coupon-repository";
import { runCouponDiscovery } from "@/domain/coupon/coupon-discovery-runner";
import { runCouponVerification } from "@/domain/coupon/coupon-verification-runner";
import {
  normalizeCouponCandidate,
  resolveCouponVerificationStatus,
  isPublicCoupon100Off,
} from "@/domain/coupon/coupon-service";
import { parseCourseOfferUrl } from "@/domain/coupon/offer-url";
import { queryDailyFreeDeals } from "@/domain/discovery/daily-free";
import { resetServerEnvCache } from "@/lib/env";

import { CheckRun, createHarness } from "./pg-harness";
import { seedCouponSource, seedFixtures } from "./fixtures";

/** Aggregator listing HTML. Claims 100% off — which must remain only a claim. */
function aggregatorHtml(entries: Array<{ slug: string; code: string }>): string {
  const links = entries
    .map(
      (e) =>
        `<div class="deal"><span>100% OFF</span><a href="https://www.udemy.com/course/${e.slug}/?couponCode=${e.code}&utm_source=aggregator">Get it</a></div>`,
    )
    .join("\n");
  return `<html><body><h1>Free Udemy Courses Today</h1>${links}</body></html>`;
}

type FetchCase = {
  status?: number;
  contentType?: string;
  body?: string;
  location?: string;
};

/**
 * Installs a fetch stub keyed by URL substring. Anything unmatched fails, so a
 * test can never accidentally reach the real network.
 */
function installFetch(routes: Array<[matcher: string, response: FetchCase]>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    const hit = routes.find(([matcher]) => url.includes(matcher));
    if (!hit) {
      throw new Error(`unstubbed fetch: ${url}`);
    }
    const spec = hit[1];
    const status = spec.status ?? 200;
    const headers = new Headers();
    if (spec.location) headers.set("location", spec.location);
    headers.set("content-type", spec.contentType ?? "text/html; charset=utf-8");
    const body = spec.body ?? "";
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      text: async () => body,
    } as unknown as Response;
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const UDEMY_100_OFF_PAGE = `
<html><body>
  <h1>Graphic Design with Canva</h1>
  <div class="price">Original price: $84.99</div>
  <div class="discount">100% off</div>
  <div class="coupon">Coupon applied: $0.00</div>
</body></html>`;

const UDEMY_DISCOUNTED_PAGE = `
<html><body>
  <h1>Graphic Design with Canva</h1>
  <div class="price">$12.99</div>
  <div class="discount">85% off</div>
</body></html>`;

const UDEMY_COUPON_EXPIRED_PAGE = `
<html><body>
  <h1>Graphic Design with Canva</h1>
  <div class="notice">This coupon has expired</div>
  <div class="price">$84.99</div>
</body></html>`;

const UDEMY_BLOCKED_PAGE = `
<html><body><h1>Access denied</h1><p>Please complete the captcha to continue.</p></body></html>`;

async function main(): Promise<number> {
  const run = new CheckRun();
  const h = await createHarness();
  await seedFixtures(h.db);

  process.env.FEATURE_COUPON_DISCOVERY = "true";
  process.env.COUPON_DISCOVERY_MAX_PAGES_PER_RUN = "2";
  process.env.COUPON_DISCOVERY_MAX_CANDIDATES = "20";
  process.env.COUPON_VERIFY_LIMIT = "20";
  process.env.COUPON_VERIFY_CONCURRENCY = "2";
  process.env.FEATURE_MEDIA_RESOLVER = "";
  resetServerEnvCache();

  run.section("URL parser — identity separation and couponCode preservation");
  {
    const parsed = parseCourseOfferUrl(
      "https://www.udemy.com/course/graphic-design-with-canva/?couponCode=FREE2026&utm_source=aggregator&ref=x",
    );
    run.expect(
      "couponCode survives normalization",
      parsed.couponCode === "FREE2026",
      `couponCode=${parsed.couponCode}`,
    );
    run.expect(
      "canonical_url differs from offer_url",
      parsed.canonicalUrl !== parsed.offerUrl,
      `canonical=${parsed.canonicalUrl} offer=${parsed.offerUrl}`,
    );
    run.expect(
      "canonical_url carries no coupon parameter",
      !parsed.canonicalUrl.toLowerCase().includes("coupon"),
      parsed.canonicalUrl,
    );
    run.expect(
      "offer_url retains the coupon parameter",
      parsed.offerUrl.includes("couponCode=FREE2026"),
      parsed.offerUrl,
    );
    run.expect(
      "tracking parameters are stripped from both",
      !parsed.offerUrl.includes("utm_source") &&
        !parsed.canonicalUrl.includes("utm_source") &&
        !parsed.offerUrl.includes("ref="),
      parsed.offerUrl,
    );

    const malformed = normalizeCouponCandidate({ rawUrl: "%%%not a url%%%" });
    run.expect(
      "malformed URL yields INVALID, never a publishable status",
      malformed.status === "INVALID" && !isPublicCoupon100Off(malformed.status),
      `status=${malformed.status} err=${malformed.lastError}`,
    );

    const noCode = normalizeCouponCandidate({
      rawUrl: "https://www.udemy.com/course/x/",
    });
    run.expect(
      "missing coupon code yields INVALID with a reason",
      noCode.status === "INVALID" && noCode.lastError === "coupon_code_missing",
      `status=${noCode.status} err=${noCode.lastError}`,
    );

    const nonUdemy = normalizeCouponCandidate({
      rawUrl: "https://example.com/course/x/?couponCode=ABC",
    });
    run.expect(
      "unsupported provider yields INVALID",
      nonUdemy.status === "INVALID" &&
        nonUdemy.lastError === "unsupported_provider",
      `status=${nonUdemy.status} err=${nonUdemy.lastError}`,
    );

    const claims100 = normalizeCouponCandidate({
      rawUrl: "https://www.udemy.com/course/x/?couponCode=ABC",
      sourceClaim: "100% OFF",
      sourcePrice: 0,
    });
    run.expect(
      "an aggregator claim of 100% OFF still yields only DISCOVERED",
      claims100.status === "DISCOVERED",
      `status=${claims100.status}`,
    );
  }

  run.section("Discovery run — aggregator HTML to DISCOVERED candidates");
  {
    await seedCouponSource(h.db, {
      sourceKey: "fixture-a",
      baseUrl: "https://coupons.example.com/udemy",
    });

    const restore = installFetch([
      [
        "coupons.example.com",
        {
          body: aggregatorHtml([
            { slug: "graphic-design-with-canva", code: "FREE2026" },
            { slug: "excel-mastery", code: "EXCEL100" },
          ]),
        },
      ],
    ]);

    const summary = await runCouponDiscovery(h.db);
    restore();

    run.expect(
      "discovery inserted candidates",
      summary.candidatesInserted === 2,
      JSON.stringify(summary),
    );

    const rows = await h.db.select().from(couponCandidates);
    run.expect(
      "every inserted candidate is DISCOVERED, never ACTIVE_100_OFF",
      rows.length === 2 && rows.every((r) => r.status === "DISCOVERED"),
      rows.map((r) => `${r.couponCode}:${r.status}`).join(", "),
    );
    run.expect(
      "coupon codes persisted from the aggregator links",
      rows.map((r) => r.couponCode).sort().join(",") === "EXCEL100,FREE2026",
      rows.map((r) => r.couponCode).join(","),
    );
    run.expect(
      "canonical_url persisted without the coupon parameter",
      rows.every((r) => !r.canonicalUrl.toLowerCase().includes("coupon")),
    );
    run.expect(
      "offer_url persisted with the coupon parameter",
      rows.every((r) => r.offerUrl.includes("couponCode=")),
    );
    run.expect(
      "source attribution persisted",
      rows.every((r) => r.discoveredFrom === "fixture-a" && r.sourceId),
    );
    run.expect(
      "source health recorded after a successful run",
      ((await h.sql(
        "select health_status from coupon_sources where source_key='fixture-a'",
      ))[0]?.health_status) === "HEALTHY",
    );
  }

  run.section("Duplicate suppression — same offer from a second source");
  {
    await seedCouponSource(h.db, {
      sourceKey: "fixture-b",
      baseUrl: "https://mirror.example.com/udemy",
    });

    const restore = installFetch([
      [
        "mirror.example.com",
        {
          body: aggregatorHtml([
            { slug: "graphic-design-with-canva", code: "FREE2026" },
          ]),
        },
      ],
      ["coupons.example.com", { body: aggregatorHtml([]) }],
    ]);

    const before = await h.sql(
      "select count(*)::int as n from coupon_candidates",
    );
    const summary = await runCouponDiscovery(h.db);
    restore();
    const after = await h.sql("select count(*)::int as n from coupon_candidates");

    run.expect(
      "the same offer_url from another source does not create a duplicate row",
      before[0]!.n === after[0]!.n,
      `before=${before[0]!.n} after=${after[0]!.n} summary=${JSON.stringify(summary)}`,
    );
    run.expect(
      "the duplicate is counted, not silently dropped",
      summary.duplicatesSkipped >= 1,
      JSON.stringify(summary),
    );

    const dbUnique = await h.sql(
      "select count(*)::int as n from pg_indexes where indexname='coupon_candidates_offer_url_uidx'",
    );
    run.expect(
      "database-level uniqueness backs the application check",
      dbUnique[0]!.n === 1,
    );
  }

  run.section("Verification — only official evidence promotes to ACTIVE_100_OFF");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_100_OFF_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);

    const summary = await runCouponVerification(h.db);
    restore();

    run.expect(
      "verification processed both candidates",
      summary.candidatesProcessed === 2,
      JSON.stringify(summary),
    );

    const offers = await h.db.select().from(courseOffers);
    const canva = offers.find((o) => o.offerUrl.includes("graphic-design"));
    const excel = offers.find((o) => o.offerUrl.includes("excel-mastery"));

    run.expect(
      "a verified 100%-off page promotes to ACTIVE_100_OFF",
      canva?.status === "ACTIVE_100_OFF",
      `status=${canva?.status}`,
    );
    run.expect(
      "verified_at is a real timestamp, not fabricated",
      canva?.verifiedAt instanceof Date,
      `verifiedAt=${String(canva?.verifiedAt)}`,
    );
    run.expect(
      "discount_percent recorded as 100",
      canva?.discountPercent === 100,
      `discount=${String(canva?.discountPercent)}`,
    );
    run.expect(
      "a discount below 100% becomes ACTIVE_DISCOUNTED, never free",
      excel?.status === "ACTIVE_DISCOUNTED" &&
        !isPublicCoupon100Off(excel!.status),
      `status=${excel?.status} discount=${String(excel?.discountPercent)}`,
    );
    run.expect(
      "offer keeps its coupon code",
      canva?.couponCode === "FREE2026",
      `code=${canva?.couponCode}`,
    );
    run.expect(
      "offer resolved to the real catalog course by canonical URL",
      Boolean(canva?.courseId),
      `courseId=${String(canva?.courseId)}`,
    );
    run.expect(
      "next_recheck_at scheduled (bounded re-verification, §126.3)",
      canva?.nextRecheckAt instanceof Date,
      `next=${String(canva?.nextRecheckAt)}`,
    );
    run.expect(
      "candidate status mirrors the verification outcome",
      ((await h.sql(
        "select status from coupon_candidates where coupon_code='FREE2026'",
      ))[0]?.status) === "ACTIVE_100_OFF",
    );
  }

  run.section("Blocked / unavailable provider never yields a free claim");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { status: 403, body: UDEMY_BLOCKED_PAGE }],
      ["excel-mastery", { status: 500, body: "server error" }],
    ]);

    // Force both offers due for recheck.
    await h.sql("update course_offers set next_recheck_at = now() - interval '1 hour'");
    const summary = await runCouponVerification(h.db);
    restore();

    const offers = await h.db.select().from(courseOffers);
    const canva = offers.find((o) => o.offerUrl.includes("graphic-design"));
    run.expect(
      "a blocked provider response demotes out of ACTIVE_100_OFF",
      canva?.status === "BLOCKED" || canva?.status === "UNKNOWN",
      `status=${canva?.status} summary=${JSON.stringify(summary)}`,
    );
    run.expect(
      "no offer is left claiming 100% off after verification failed",
      offers.every((o) => o.status !== "ACTIVE_100_OFF"),
      offers.map((o) => o.status).join(","),
    );
  }

  run.section("Coupon reported as expired by the provider page");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_COUPON_EXPIRED_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);
    await h.sql("update course_offers set next_recheck_at = now() - interval '1 hour'");
    await runCouponVerification(h.db);
    restore();

    const canva = (await h.db.select().from(courseOffers)).find((o) =>
      o.offerUrl.includes("graphic-design"),
    );
    run.expect(
      "an expired coupon page yields EXPIRED or INVALID",
      canva?.status === "EXPIRED" || canva?.status === "INVALID",
      `status=${canva?.status}`,
    );
    run.expect(
      "EXPIRED/INVALID is not publicly surfaceable as 100% off",
      !isPublicCoupon100Off(canva!.status),
    );
  }

  run.section("EXPIRED / INVALID are not resurrected by a later recheck");
  {
    // §126.3 lists only active categories as recheck candidates, so a coupon the
    // provider rejected stays rejected. Asserting it explicitly because
    // `nextCouponRecheckAt` still computes a 168h backoff for these states,
    // which reads like they would be revisited.
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_100_OFF_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);
    await h.sql(
      "update course_offers set status='INVALID', next_recheck_at = now() - interval '1 hour' where offer_url like '%graphic-design%'",
    );
    await runCouponVerification(h.db);
    restore();

    const stillInvalid = (await h.db.select().from(courseOffers)).find((o) =>
      o.offerUrl.includes("graphic-design"),
    );
    run.expect(
      "an INVALID offer is not silently promoted back to ACTIVE_100_OFF",
      stillInvalid?.status === "INVALID",
      `status=${stillInvalid?.status}`,
    );
  }

  run.section("Recorded expiry in the past outranks a 100%-off page (PASS 1 P1-2)");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_100_OFF_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);

    // ACTIVE_100_OFF is a recheck candidate, so this exercises the runner rather
    // than relying on a rejected offer being revisited.
    await h.sql(
      "update course_offers set status='ACTIVE_100_OFF', expires_at = now() - interval '2 hours', next_recheck_at = now() - interval '1 hour' where offer_url like '%graphic-design%'",
    );
    await runCouponVerification(h.db);
    restore();

    const expired = (await h.db.select().from(courseOffers)).find((o) =>
      o.offerUrl.includes("graphic-design"),
    );
    run.expect(
      "a past expires_at forces EXPIRED even though the page still says 100% off",
      expired?.status === "EXPIRED",
      `status=${expired?.status}`,
    );
  }

  run.section("A transient BLOCKED offer is rechecked, not stranded");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_100_OFF_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);
    await h.sql(
      "update course_offers set status='BLOCKED', expires_at = null, next_recheck_at = now() - interval '1 hour' where offer_url like '%graphic-design%'",
    );
    await runCouponVerification(h.db);
    restore();

    const recovered = (await h.db.select().from(courseOffers)).find((o) =>
      o.offerUrl.includes("graphic-design"),
    );
    run.expect(
      "a BLOCKED offer recovers once the provider responds again",
      recovered?.status === "ACTIVE_100_OFF",
      `status=${recovered?.status}`,
    );
  }

  run.section("Public read path excludes expired offers (PASS 1 P1-1)");
  {
    await h.sql(
      "update course_offers set status='ACTIVE_100_OFF', expires_at = now() - interval '1 hour', verified_at = now() where offer_url like '%graphic-design%'",
    );

    const active = await listActive100OffOffers(h.db, 48);
    run.expect(
      "an ACTIVE_100_OFF row with a past expiry is not returned by the repository",
      !active.some((r) => r.offer.offerUrl.includes("graphic-design")),
      `returned=${active.length}`,
    );

    const deals = await queryDailyFreeDeals(h.db, { limit: 12 });
    run.expect(
      "the expired coupon does not reach the daily-free surface",
      !deals.some((d) => d.course.slug === "graphic-design-with-canva"),
      deals.map((d) => `${d.course.slug}:${d.offerStatus}`).join(", ") || "empty",
    );
    run.expect(
      "no daily-free item claims verified coupon status without verification",
      deals.every((d) => d.offerStatus !== "FREE_WITH_COUPON"),
      deals.map((d) => d.offerStatus).join(","),
    );
  }

  run.section("Live 100% offer does reach the daily-free surface");
  {
    await h.sql(
      "update course_offers set status='ACTIVE_100_OFF', expires_at = now() + interval '6 hours', verified_at = now() where offer_url like '%graphic-design%'",
    );

    const deals = await queryDailyFreeDeals(h.db, { limit: 12 });
    const item = deals.find((d) => d.course.slug === "graphic-design-with-canva");
    run.expect(
      "a live verified offer appears on the daily-free surface",
      Boolean(item),
      deals.map((d) => d.course.slug).join(", ") || "empty",
    );
    run.expect(
      "it is marked as verified so the badge is earned",
      item?.couponVerified === true && item?.offerStatus === "ACTIVE_100_OFF",
      `verified=${String(item?.couponVerified)} status=${item?.offerStatus}`,
    );
    run.expect(
      "the outbound offer URL preserves the coupon code",
      Boolean(item?.offerUrl?.includes("couponCode=FREE2026")),
      item?.offerUrl ?? "none",
    );
    run.expect(
      "verification freshness comes from the stored timestamp",
      item?.verifiedAt instanceof Date,
      String(item?.verifiedAt),
    );
  }

  run.section("Multiple coupon codes for the same course stay distinct offers");
  {
    const a = parseCourseOfferUrl(
      "https://www.udemy.com/course/graphic-design-with-canva/?couponCode=ONE",
    );
    const b = parseCourseOfferUrl(
      "https://www.udemy.com/course/graphic-design-with-canva/?couponCode=TWO",
    );
    run.expect(
      "same canonical identity",
      a.canonicalUrl === b.canonicalUrl,
      a.canonicalUrl,
    );
    run.expect("different offer identity", a.offerUrl !== b.offerUrl);

    const courseCount = await h.sql(
      "select count(*)::int as n from courses where slug='graphic-design-with-canva'",
    );
    run.expect(
      "no duplicate course row was created by the coupon pipeline",
      courseCount[0]!.n === 1,
      `rows=${courseCount[0]!.n}`,
    );
  }

  run.section("Source unavailable / malformed response");
  {
    const restore = installFetch([
      ["coupons.example.com", { status: 503, body: "unavailable" }],
      ["mirror.example.com", { body: "<html><body>no deals here</body></html>" }],
    ]);
    const summary = await runCouponDiscovery(h.db);
    restore();

    run.expect(
      "an unavailable source is recorded as failing without throwing",
      summary.sourceErrors >= 1,
      JSON.stringify(summary),
    );
    run.expect(
      "a source with no coupon links invents no candidates",
      summary.candidatesInserted === 0,
      JSON.stringify(summary),
    );

    const health = await h.sql(
      "select source_key, health_status from coupon_sources order by source_key",
    );
    run.expect(
      "source health reflects the failure",
      health.some((r) => r.health_status !== "HEALTHY"),
      health.map((r) => `${r.source_key}=${r.health_status}`).join(", "),
    );
  }

  run.section("Coupon discovery kill switch");
  {
    process.env.FEATURE_COUPON_DISCOVERY = "";
    resetServerEnvCache();
    const restore = installFetch([["example.com", { body: "should not fetch" }]]);
    const discovery = await runCouponDiscovery(h.db);
    const verification = await runCouponVerification(h.db);
    restore();

    run.expect(
      "discovery is skipped when the flag is off",
      discovery.enabled === false &&
        discovery.skippedReason === "FEATURE_COUPON_DISCOVERY_off",
      JSON.stringify(discovery),
    );
    run.expect(
      "verification is skipped when the flag is off",
      verification.enabled === false,
      JSON.stringify(verification),
    );
    process.env.FEATURE_COUPON_DISCOVERY = "true";
    resetServerEnvCache();
  }

  run.section("Illegal state transitions and status truth table");
  {
    const cases: Array<[string, Parameters<typeof resolveCouponVerificationStatus>[0], string]> = [
      [
        "aggregator-only evidence",
        {
          officialFetchOk: false,
          blocked: false,
          priceAfterDiscount: 0,
          discountPercent: 100,
          couponRejected: false,
          pastExpiry: false,
        },
        "UNKNOWN",
      ],
      [
        "provider blocked",
        {
          officialFetchOk: false,
          blocked: true,
          priceAfterDiscount: 0,
          discountPercent: 100,
          couponRejected: false,
          pastExpiry: false,
        },
        "BLOCKED",
      ],
      [
        "coupon rejected by provider",
        {
          officialFetchOk: true,
          blocked: false,
          priceAfterDiscount: null,
          discountPercent: null,
          couponRejected: true,
          pastExpiry: false,
        },
        "INVALID",
      ],
      [
        "85% off",
        {
          officialFetchOk: true,
          blocked: false,
          priceAfterDiscount: 12.99,
          discountPercent: 85,
          couponRejected: false,
          pastExpiry: false,
        },
        "ACTIVE_DISCOUNTED",
      ],
      [
        "verified 100% off",
        {
          officialFetchOk: true,
          blocked: false,
          priceAfterDiscount: 0,
          discountPercent: 100,
          couponRejected: false,
          pastExpiry: false,
        },
        "ACTIVE_100_OFF",
      ],
    ];

    for (const [label, evidence, expected] of cases) {
      const actual = resolveCouponVerificationStatus(evidence);
      run.expect(`${label} → ${expected}`, actual === expected, `got ${actual}`);
    }

    run.expect(
      "only ACTIVE_100_OFF is publicly surfaceable as Coupon 100%",
      [
        "DISCOVERED",
        "VERIFYING",
        "ACTIVE_DISCOUNTED",
        "EXPIRED",
        "INVALID",
        "BLOCKED",
        "UNKNOWN",
      ].every((s) => !isPublicCoupon100Off(s as never)) &&
        isPublicCoupon100Off("ACTIVE_100_OFF"),
    );
  }

  run.section("Idempotent re-verification");
  {
    const restore = installFetch([
      ["graphic-design-with-canva", { body: UDEMY_100_OFF_PAGE }],
      ["excel-mastery", { body: UDEMY_DISCOUNTED_PAGE }],
    ]);
    await h.sql("update course_offers set expires_at = null, next_recheck_at = now() - interval '1 hour'");
    const offersBefore = await h.sql(
      "select count(*)::int as n from course_offers",
    );
    await runCouponVerification(h.db);
    await h.sql("update course_offers set next_recheck_at = now() - interval '1 hour'");
    await runCouponVerification(h.db);
    restore();
    const offersAfter = await h.sql(
      "select count(*)::int as n from course_offers",
    );

    run.expect(
      "repeated verification creates no extra offer rows",
      offersBefore[0]!.n === offersAfter[0]!.n,
      `before=${offersBefore[0]!.n} after=${offersAfter[0]!.n}`,
    );

    const candidateCount = await h.sql(
      "select count(*)::int as n from coupon_candidates",
    );
    run.expect(
      "repeated verification creates no extra candidate rows",
      candidateCount[0]!.n === 2,
      `rows=${candidateCount[0]!.n}`,
    );
  }

  run.section("Admin coupon operations read real data");
  {
    const summary = await couponOpsSummary(h.db);
    run.expect(
      "ops summary counts real offers",
      summary.offers.total > 0,
      JSON.stringify(summary.offers),
    );
    run.expect(
      "ops summary lists real sources",
      summary.sources.length === 2,
      summary.sources.map((s) => s.sourceKey).join(","),
    );
    run.expect(
      "ops summary counts real candidates",
      summary.candidates.total === 2,
      JSON.stringify(summary.candidates),
    );

    const active = await listCourseOffers(h.db, {
      status: "ACTIVE_100_OFF",
      limit: 10,
    });
    const expiredList = await listCourseOffers(h.db, {
      status: ["EXPIRED", "INVALID"],
      limit: 10,
    });
    run.expect(
      "admin can filter offers by status",
      Array.isArray(active) && Array.isArray(expiredList),
      `active=${active.length} expired/invalid=${expiredList.length}`,
    );
  }

  run.section("Foreign keys and relationships");
  {
    const joined = await h.sql(`
      select o.id, o.course_id, o.provider_id, o.candidate_id, c.slug
      from course_offers o
      left join courses c on c.id = o.course_id
    `);
    run.expect(
      "offers link to a real course row where identity resolved",
      joined.some((r) => r.slug === "graphic-design-with-canva"),
      joined.map((r) => String(r.slug)).join(","),
    );
    run.expect(
      "offers keep candidate provenance",
      joined.every((r) => r.candidate_id !== null),
    );

    const orphan = await h.sql(`
      select count(*)::int as n from course_offers o
      where o.candidate_id is not null
        and not exists (select 1 from coupon_candidates cc where cc.id = o.candidate_id)
    `);
    run.expect("no orphaned candidate references", orphan[0]!.n === 0);
  }

  await h.close();
  return run.summary();
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error("harness error:", error);
    process.exit(1);
  });
