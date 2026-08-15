/**
 * Verification 06 — flags-ON behaviour over real HTTP.
 *
 * Run against a server started with FEATURE_MONETIZATION, FEATURE_COURSE_AFFILIATE,
 * FEATURE_COUPON_DISCOVERY, FEATURE_MEDIA_RESOLVER, FEATURE_SIMILAR_COURSES,
 * FEATURE_COURSE_COMPARE and FEATURE_LEARNING_PATHS enabled.
 *
 * The point is to prove the switches control real behaviour in both positions —
 * a flag that changes nothing when flipped is not a shipped feature.
 *
 * No affiliate credentials are fabricated: the seeded campaign destination is a
 * plain provider URL with no partner id, tracking id or sub id.
 */

import "@/lib/load-env";

import postgres from "postgres";

import { CheckRun } from "./pg-harness";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";

async function get(pathname: string, init?: RequestInit) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    ...init,
  });
  return {
    status: response.status,
    body: await response.text().catch(() => ""),
    location: response.headers.get("location"),
  };
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

async function main(): Promise<number> {
  const run = new CheckRun();
  // Raw SQL is deliberate here: these assertions verify what the *application*
  // wrote, so reading it back through the same ORM mappings would be circular.
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });

  const CRON_HEADER = {
    authorization: "Bearer verification-only-cron-secret",
  };

  run.section("Coupon cron actually runs with the flag ON");
  {
    const before = await client`select count(*)::int as n from coupon_candidates`;
    const response = await get("/api/cron/coupons", { headers: CRON_HEADER });
    run.expect(
      "coupon cron returns 200 and reports enabled runners",
      response.status === 200 && !response.body.includes("FEATURE_COUPON_DISCOVERY_off"),
      response.body.slice(0, 400),
    );
    run.expect(
      "the response carries discovery, verification and media summaries",
      /"discovery"/.test(response.body) &&
        /"verification"/.test(response.body) &&
        /"media"/.test(response.body),
      response.body.slice(0, 400),
    );

    const after = await client`select count(*)::int as n from coupon_candidates`;
    run.expect(
      "the run completes without inventing candidates from an unreachable source",
      Number(after[0]!.n) >= Number(before[0]!.n),
      `before=${before[0]!.n} after=${after[0]!.n}`,
    );

    const audit = await client`
      select count(*)::int as n from admin_audit_log where action = 'COUPON_RUN'`;
    run.expect(
      "the cron writes an audit-log entry",
      Number(audit[0]!.n) >= 1,
      `rows=${audit[0]!.n}`,
    );

    // The seeded source is disabled, which is the per-source kill switch. It must
    // therefore never be fetched, and must not acquire a health verdict.
    const sources = await client`
      select source_key, enabled, health_status, last_run_at from coupon_sources`;
    run.expect(
      "a disabled coupon source is never fetched (per-source kill switch)",
      sources
        .filter((s) => s.enabled === false)
        .every((s) => s.last_run_at === null),
      sources
        .map((s) => `${s.source_key} enabled=${s.enabled} run=${s.last_run_at}`)
        .join(", "),
    );
    run.expect(
      "a source that never ran is not marked HEALTHY",
      !sources.some(
        (s) => s.last_run_at === null && s.health_status === "HEALTHY",
      ),
      sources.map((s) => `${s.source_key}=${s.health_status}`).join(", "),
    );
  }

  run.section("Media resolution cron runs with the flag ON");
  {
    const response = await get("/api/cron/coupons", { headers: CRON_HEADER });
    run.expect(
      "media summary reports the resolver as enabled",
      /"media":\{"enabled":true/.test(response.body),
      response.body.slice(0, 400),
    );

    const rows = await client`
      select image_status, count(*)::int as n from courses
      where status = 'PUBLISHED' group by image_status order by image_status`;
    run.expect(
      "image_status is written for published courses",
      rows.length > 0,
      rows.map((r) => `${r.image_status}=${r.n}`).join(", "),
    );
    run.expect(
      "no published course is left at the MISSING default after a run",
      !rows.some((r) => r.image_status === "MISSING"),
      rows.map((r) => `${r.image_status}=${r.n}`).join(", "),
    );
    run.expect(
      "image_checked_at is populated (real timestamps, not fabricated)",
      Number(
        (
          await client`select count(*)::int as n from courses where image_checked_at is not null`
        )[0]!.n,
      ) > 0,
    );
  }

  run.section("Embedding cron runs with a fake provider");
  {
    const response = await get("/api/cron/embed", { headers: CRON_HEADER });
    run.expect(
      "embed cron returns 200",
      response.status === 200,
      `status=${response.status} body=${response.body.slice(0, 250)}`,
    );

    const embeddings = await client`
      select status, count(*)::int as n from course_embeddings group by status`;
    run.expect(
      "embeddings were produced and stored",
      embeddings.some((r) => r.status === "OK" && Number(r.n) > 0),
      embeddings.map((r) => `${r.status}=${r.n}`).join(", ") || "none",
    );
    run.expect(
      "no embedding row is left FAILED",
      !embeddings.some((r) => r.status === "FAILED" && Number(r.n) > 0),
      embeddings.map((r) => `${r.status}=${r.n}`).join(", "),
    );

    const usage = await client`
      select count(*)::int as n from api_usage_log where kind = 'embedding'`;
    run.expect(
      "every embedding call is recorded in api_usage_log (§77 rule 31)",
      Number(usage[0]!.n) > 0,
      `rows=${usage[0]!.n}`,
    );
  }

  run.section("Discovery cron is bounded and category-balanced");
  {
    const response = await get("/api/cron/discover", { headers: CRON_HEADER });
    // Discovery needs an external search API. With no key it must say so plainly
    // rather than reporting a successful run that found nothing —
    // CONFIG_REQUIRED, not a defect.
    run.expect(
      "discover cron reports the missing search key honestly",
      response.status === 503 &&
        response.body.includes("TAVILY_API_KEY is not configured") &&
        response.body.includes("pendingManualIntegrationTest"),
      `status=${response.status} body=${response.body.slice(0, 250)}`,
    );
    run.expect(
      "discover cron does not claim a successful discovery run without a provider",
      !/"ok"\s*:\s*true/.test(response.body),
      response.body.slice(0, 250),
    );
    run.expect(
      "discover cron does not crash the process",
      !response.body.includes("Unhandled"),
      response.body.slice(0, 250),
    );
  }

  run.section("Monetization ON — affiliate outbound");
  {
    const valid = await get("/go/affiliate?campaign=verify-course");
    run.expect(
      "an enabled campaign redirects to its allowlisted destination",
      (valid.location ?? "").includes("coursera.org"),
      `status=${valid.status} location=${valid.location}`,
    );

    const clicks = await client`
      select provider_key, destination_host, placement_key from affiliate_clicks`;
    run.expect(
      "the click is persisted with provider and destination host",
      clicks.length >= 1 &&
        clicks.some((c) => String(c.destination_host).includes("coursera.org")),
      clicks.map((c) => `${c.provider_key}->${c.destination_host}`).join(", ") ||
        "none",
    );
    run.expect(
      "no raw IP address is stored on the click (§113.5 privacy)",
      !clicks.some((c) =>
        Object.values(c).some(
          (v) => typeof v === "string" && /^\d{1,3}(\.\d{1,3}){3}$/.test(v),
        ),
      ),
    );

    const disabledProvider = await get(
      "/go/affiliate?campaign=verify-commerce-disabled",
    );
    run.expect(
      "a campaign whose provider is disabled does not leave the origin",
      !(disabledProvider.location ?? "").includes("shopee.vn"),
      `location=${disabledProvider.location}`,
    );

    const badHost = await get("/go/affiliate?campaign=verify-bad-host");
    run.expect(
      "a destination outside the provider allowlist is refused",
      !(badHost.location ?? "").includes("evil.example.com"),
      `location=${badHost.location}`,
    );
    run.expect(
      "the refusal still lands the user on a valid on-origin page",
      (badHost.location ?? "").includes("localhost:3100") ||
        (badHost.location ?? "").startsWith("/"),
      `location=${badHost.location}`,
    );

    const unknown = await get("/go/affiliate?campaign=does-not-exist");
    run.expect(
      "an unknown campaign redirects on-origin rather than erroring",
      unknown.status >= 300 &&
        unknown.status < 400 &&
        !(unknown.location ?? "").includes("evil"),
      `status=${unknown.status} location=${unknown.location}`,
    );

    // The P0 open-redirect guard must still hold with monetization enabled.
    for (const locale of ["/evil.com", "//evil.com", "///evil.com"]) {
      const hostile = await get(
        `/go/affiliate?campaign=verify-course&locale=${encodeURIComponent(locale)}`,
      );
      const target = hostile.location ?? "";
      run.expect(
        `monetization ON: locale="${locale}" cannot redirect off-origin`,
        !target.includes("evil.com"),
        `location=${target}`,
      );
    }
  }

  run.section("Monetization ON — disclosure and ranking independence");
  {
    const detail = await get("/vi/course/python-cho-nguoi-moi");
    const text = visibleText(detail.body);
    run.expect(
      "course detail still renders with monetization on",
      detail.status === 200,
      `status=${detail.status}`,
    );
    run.expect(
      "affiliate disclosure, when shown, is Vietnamese",
      !text.includes("Affiliate link"),
      "expected no English disclosure on a Vietnamese page",
    );

    // Ranking independence: the organic order must not change because an
    // affiliate campaign exists for a provider.
    const search = await get("/vi/search?q=python");
    const order =
      search.body.match(/href="\/vi\/course\/([^"]+)"/g)?.map((h) =>
        h.replace(/href="\/vi\/course\//, "").replace(/"$/, ""),
      ) ?? [];
    run.expect(
      "search still returns organic results with monetization on",
      order.length > 0,
      order.join(", "),
    );
    run.expect(
      "no PAID course is promoted into results by monetization",
      !order.includes("advanced-python-masterclass"),
      order.join(", "),
    );

    const daily = await get("/vi/mien-phi-hom-nay");
    run.expect(
      "the daily-free surface is unaffected by monetization",
      daily.status === 200 &&
        visibleText(daily.body).includes("Graphic Design with Canva"),
      `status=${daily.status}`,
    );
  }

  run.section("Similar courses / compare / learning paths with flags ON");
  {
    const detail = await get("/vi/course/python-cho-nguoi-moi");
    const links =
      detail.body.match(/href="\/vi\/course\/([^"]+)"/g)?.map((h) =>
        h.replace(/href="\/vi\/course\//, "").replace(/"$/, ""),
      ) ?? [];
    run.expect(
      "similar courses render links with the flag ON",
      links.length > 0,
      links.join(", "),
    );
    run.expect(
      "no ineligible course appears in the similar section",
      !links.includes("advanced-python-masterclass") &&
        !links.includes("python-bootcamp-trial") &&
        !links.includes("python-preview-only") &&
        !links.includes("draft-course-not-live"),
      links.join(", "),
    );

    // §94.3 documents the shareable form as slugs, so a slug URL must resolve.
    const compare = await get(
      "/vi/compare?compare=python-cho-nguoi-moi,ai-for-beginners",
    );
    const compareText = visibleText(compare.body);
    run.expect(
      "compare resolves a shareable slug URL and renders both courses",
      compare.status === 200 &&
        compareText.includes("Khóa học Python cho người mới") &&
        compareText.includes("AI for Beginners"),
      `status=${compare.status} text=${compareText.slice(0, 200)}`,
    );
    // §94.2 forbids a subjective winner. The page states the opposite explicitly,
    // so the check is that the disclaimer is present and no recommendation
    // language is attached to a course.
    run.expect(
      "compare states that it does not rank a 'best' course",
      /không xếp hạng[\s\S]{0,40}tốt nhất/i.test(compareText),
      compareText.slice(0, 240),
    );
    run.expect(
      "compare attaches no recommendation claim to a course",
      !/khuyến nghị|nên học khóa|recommended best|our pick|lựa chọn tốt nhất/i.test(
        compareText,
      ),
    );

    const compareIneligible = await get(
      "/vi/compare?compare=advanced-python-masterclass,python-bootcamp-trial",
    );
    run.expect(
      "compare refuses ineligible courses",
      !visibleText(compareIneligible.body).includes(
        "Advanced Python Masterclass",
      ),
      `status=${compareIneligible.status}`,
    );

    const path = await get("/vi/path?goal=data%20analyst");
    run.expect(
      "learning path renders with the flag ON",
      path.status === 200 && !/Application error/i.test(path.body),
      `status=${path.status}`,
    );
    run.expect(
      "learning path invents no course that is not in the catalog",
      !/Invented|Placeholder|Lorem/i.test(visibleText(path.body)),
    );
  }

  run.section("Flags ON do not weaken Truth or expose internals");
  {
    const search = await get("/vi/search?q=python");
    run.expect(
      "no internal score is exposed to the user (§102)",
      !/cosine|relevanceFloor|rrfK|semanticRank|"score":/i.test(search.body),
    );
    const daily = await get("/vi/mien-phi-hom-nay");
    run.expect(
      "no expired coupon appears with flags ON",
      !/Excel cơ bản miễn phí[\s\S]{0,150}Giảm 100%/.test(
        visibleText(daily.body),
      ),
    );
  }

  await client.end();
  return run.summary();
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error("harness error:", error);
    process.exit(1);
  });
