/**
 * Verification 04 — media pipeline, access classification, multi-domain
 * discovery and category/topic surfaces, against a real Postgres.
 *
 * The media section drives the real `runMediaResolution` runner with a stubbed
 * network, so `validateSafeFetchUrl`, the manual redirect loop, the content-type
 * allowlist and the size cap all execute, and the `image_*` columns are asserted
 * in the database rather than inferred.
 */

import "@/lib/load-env";

import { eq } from "drizzle-orm";

import { courses } from "@/db/schema";
import { queryCatalog, listPublishedCoursesWithProvider } from "@/db/repositories/course-repository";
import { listDiscoveryCategoryStats } from "@/db/repositories/coupon-repository";
import {
  listDueDiscoveryQueries,
  interleaveByCategory,
} from "@/domain/discovery/discovery-query-service";
import { runMediaResolution } from "@/domain/media/media-resolution-runner";
import { summarizeMediaQuality } from "@/domain/media/media-resolver";
import { validateImageUrl, fetchCourseImageSafely } from "@/services/images/course-image-service";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import {
  classifyAccessFromText,
  getAccessBadgeLabelVi,
  getAccessLabelVi,
  getCertificateLabelVi,
  isDailyFreeEligibleAccess,
  isDurableFreeAccess,
  isPreviewOrTrialOnly,
} from "@/domain/access/access-classifier";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import { getPriceTypeLabel } from "@/domain/course/labels";
import { getCourseVisual } from "@/domain/course/course-visual";
import { M21_TAXONOMY_CATEGORIES } from "@/domain/taxonomy/multi-domain";
import { SEED_DISCOVERY_QUERIES, SEED_CATEGORIES } from "@/db/seed/data";
import { resetServerEnvCache } from "@/lib/env";

import { CheckRun, createHarness } from "./pg-harness";
import { seedDiscoveryQueries, seedFixtures } from "./fixtures";

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

type ImageRoute = {
  status?: number;
  contentType?: string;
  location?: string;
  bytes?: Uint8Array;
  throws?: boolean;
};

function installImageFetch(routes: Array<[string, ImageRoute]>) {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    const hit = routes.find(([m]) => url.includes(m));
    if (!hit) throw new Error(`unstubbed image fetch: ${url}`);
    const spec = hit[1];
    if (spec.throws) throw new Error("network down");
    const headers = new Headers();
    if (spec.location) headers.set("location", spec.location);
    headers.set("content-type", spec.contentType ?? "image/png");
    const bytes = spec.bytes ?? PNG_BYTES;
    const status = spec.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers,
      arrayBuffer: async () => bytes.buffer,
    } as unknown as Response;
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, requested };
}

async function main(): Promise<number> {
  const run = new CheckRun();
  const h = await createHarness();
  const ids = await seedFixtures(h.db);

  // ───────────────────────── MEDIA ─────────────────────────

  run.section("Image URL validation (SSRF boundary, real validator)");
  {
    const hostile: Array<[string, string]> = [
      ["http://127.0.0.1/x.png", "loopback"],
      ["http://127.0.0.2/x.png", "loopback beyond .1"],
      ["http://10.1.2.3/x.png", "private 10/8"],
      ["http://172.17.0.1/x.png", "172.16/12 mid-range"],
      ["http://172.31.255.254/x.png", "172.16/12 top"],
      ["http://192.168.1.1/x.png", "private 192.168/16"],
      ["http://169.254.169.254/latest/meta-data", "cloud metadata"],
      ["http://100.64.0.1/x.png", "CGNAT"],
      ["http://[::1]/x.png", "IPv6 loopback"],
      ["http://[fd00::1]/x.png", "IPv6 ULA"],
      ["http://2130706433/x.png", "decimal IP"],
      ["http://metadata.google.internal/x.png", "metadata host"],
      ["http://localhost/x.png", "localhost"],
      ["http://foo.localhost/x.png", "localhost subdomain"],
      ["https://user:pass@cdn.example.com/x.png", "credentials in URL"],
      ["file:///etc/passwd", "file scheme"],
      ["javascript:alert(1)", "javascript scheme"],
      ["data:image/png;base64,AAAA", "data scheme"],
      ["//cdn.example.com/x.png", "protocol-relative"],
    ];
    for (const [url, label] of hostile) {
      run.expect(`rejects ${label}`, validateImageUrl(url) === null, url);
    }
    run.expect(
      "accepts a legitimate public CDN URL",
      validateImageUrl("https://img-c.udemycdn.com/course/480x270/abc.jpg")
        ?.hostname === "img-c.udemycdn.com",
    );
  }

  run.section("Image fetch failure modes (real fetch loop)");
  {
    const cases: Array<[string, ImageRoute, string]> = [
      ["404", { status: 404 }, "http_404"],
      ["wrong content type", { contentType: "text/html" }, "invalid_content_type"],
      ["network failure", { throws: true }, "fetch_failed"],
      [
        "oversized body",
        { bytes: new Uint8Array(3 * 1024 * 1024) },
        "too_large",
      ],
    ];
    for (const [label, route, expected] of cases) {
      const stub = installImageFetch([["cdn.example.com", route]]);
      const result = await fetchCourseImageSafely(
        "https://cdn.example.com/a.png",
      );
      stub.restore();
      run.expect(
        `image ${label} → ${expected}`,
        !result.ok && result.reason === expected,
        result.ok ? "ok" : result.reason,
      );
    }

    // Redirect to a private address must be refused before the hop is issued.
    const redirectStub = installImageFetch([
      [
        "cdn.example.com",
        { status: 302, location: "http://169.254.169.254/latest/meta-data" },
      ],
    ]);
    const blocked = await fetchCourseImageSafely(
      "https://cdn.example.com/a.png",
    );
    redirectStub.restore();
    run.expect(
      "redirect to cloud metadata is blocked",
      !blocked.ok && blocked.reason === "redirect_blocked",
      blocked.ok ? "ok" : blocked.reason,
    );
    run.expect(
      "the private hop was never requested",
      !redirectStub.requested.some((u) => u.includes("169.254")),
      redirectStub.requested.join(", "),
    );

    // Redirect loop must terminate.
    const loopStub = installImageFetch([
      ["a.example.com", { status: 302, location: "https://b.example.com/i.png" }],
      ["b.example.com", { status: 302, location: "https://a.example.com/i.png" }],
    ]);
    const looped = await fetchCourseImageSafely("https://a.example.com/i.png");
    loopStub.restore();
    run.expect(
      "redirect loop terminates with too_many_redirects",
      !looped.ok && looped.reason === "too_many_redirects",
      looped.ok ? "ok" : looped.reason,
    );
    run.expect(
      "redirect loop is bounded (not unbounded requests)",
      loopStub.requested.length <= 5,
      `requests=${loopStub.requested.length}`,
    );

    const okStub = installImageFetch([["cdn.example.com", {}]]);
    const good = await fetchCourseImageSafely("https://cdn.example.com/a.png");
    okStub.restore();
    run.expect(
      "a valid official image is accepted",
      good.ok && good.contentType === "image/png",
      good.ok ? good.contentType : good.reason,
    );
  }

  run.section("Media resolution runner persists image_* columns (M21.6)");
  {
    process.env.FEATURE_MEDIA_RESOLVER = "";
    resetServerEnvCache();
    const off = await runMediaResolution(h.db);
    run.expect(
      "kill switch off → runner skips",
      off.enabled === false && off.skippedReason === "FEATURE_MEDIA_RESOLVER_off",
      JSON.stringify(off),
    );

    process.env.FEATURE_MEDIA_RESOLVER = "true";
    process.env.MEDIA_RESOLVE_LIMIT = "20";
    process.env.IMAGE_RESOLVE_CONCURRENCY = "2";
    resetServerEnvCache();

    // One good image, one 404, one SSRF target, and the rest with no source.
    await h.db
      .update(courses)
      .set({ imageSourceUrl: "https://cdn.example.com/good.png" })
      .where(eq(courses.id, ids.courseIds["python-free"]!));
    await h.db
      .update(courses)
      .set({ imageSourceUrl: "https://cdn.example.com/missing.png" })
      .where(eq(courses.id, ids.courseIds["cs50"]!));
    await h.db
      .update(courses)
      .set({ imageSourceUrl: "http://169.254.169.254/meta.png" })
      .where(eq(courses.id, ids.courseIds["ai-beginners"]!));

    const stub = installImageFetch([
      ["good.png", {}],
      ["missing.png", { status: 404 }],
    ]);
    const summary = await runMediaResolution(h.db);
    stub.restore();

    run.expect(
      "runner processed courses and reported a breakdown",
      summary.enabled && summary.processed > 0,
      JSON.stringify(summary),
    );

    const rows = await h.sql(`
      select c.slug, c.image_status, c.image_source_type,
             c.image_resolved_url, c.image_fallback_reason, c.image_checked_at
      from courses c where c.status='PUBLISHED' order by c.slug
    `);

    const bySlug = new Map(rows.map((r) => [r.slug as string, r]));
    run.expect(
      "a valid image resolves to OK with a resolved URL",
      bySlug.get("python-cho-nguoi-moi")?.image_status === "OK" &&
        Boolean(bySlug.get("python-cho-nguoi-moi")?.image_resolved_url),
      JSON.stringify(bySlug.get("python-cho-nguoi-moi")),
    );
    run.expect(
      "a 404 image resolves to BROKEN with a reason",
      bySlug.get("cs50-introduction-to-programming-with-python")
        ?.image_status === "BROKEN" &&
        Boolean(
          bySlug.get("cs50-introduction-to-programming-with-python")
            ?.image_fallback_reason,
        ),
      JSON.stringify(bySlug.get("cs50-introduction-to-programming-with-python")),
    );
    run.expect(
      "an SSRF target resolves to BLOCKED, not fetched",
      bySlug.get("ai-for-beginners")?.image_status === "BLOCKED",
      JSON.stringify(bySlug.get("ai-for-beginners")),
    );
    run.expect(
      "a course with no image source is FALLBACK, not OK",
      bySlug.get("project-management-fundamentals")?.image_status ===
        "FALLBACK",
      JSON.stringify(bySlug.get("project-management-fundamentals")),
    );
    run.expect(
      "image_checked_at is a real timestamp on every processed row",
      rows.every((r) => r.image_checked_at !== null),
    );
    run.expect(
      "a fallback never claims to be official artwork",
      rows
        .filter((r) => r.image_status === "FALLBACK")
        .every(
          (r) =>
            r.image_source_type !== "OFFICIAL" &&
            r.image_resolved_url === null,
        ),
    );

    run.expect(
      "media failure never removes a course from the catalog",
      (await queryCatalog(h.db, { page: 1, pageSize: 50 })).items.length === 6,
      "eligible catalog size unchanged after media failures",
    );

    const quality = summarizeMediaQuality(
      rows.map((r) => ({
        imageStatus: r.image_status as never,
        imageSourceType: r.image_source_type as never,
      })),
    );
    run.expect(
      "media quality metrics are computed from real rows",
      quality.total === rows.length && quality.broken >= 1 && quality.blocked >= 1,
      JSON.stringify(quality),
    );

    const second = await runMediaResolution(h.db);
    run.expect(
      "a second immediate run re-checks nothing (recheck window honoured)",
      second.processed === 0,
      JSON.stringify(second),
    );
  }

  run.section("CourseCard visual falls back without pretending");
  {
    const withImage = await h.db
      .select()
      .from(courses)
      .where(eq(courses.slug, "python-cho-nguoi-moi"))
      .limit(1);
    const withoutImage = await h.db
      .select()
      .from(courses)
      .where(eq(courses.slug, "project-management-fundamentals"))
      .limit(1);

    const providers = await h.sql("select id, name, slug from providers");
    const providerById = new Map(providers.map((p) => [p.id as string, p]));

    const visualWith = getCourseVisual({
      ...withImage[0]!,
      provider: providerById.get(withImage[0]!.providerId) as never,
    } as never);
    const visualWithout = getCourseVisual({
      ...withoutImage[0]!,
      provider: providerById.get(withoutImage[0]!.providerId) as never,
    } as never);

    run.expect(
      "a resolved image is offered to the card",
      Boolean(visualWith.src),
      String(visualWith.src),
    );
    run.expect(
      "a course without an image still yields a renderable branded tile",
      !visualWithout.src && Boolean(visualWithout.title || visualWithout.eyebrow),
      JSON.stringify(visualWithout),
    );
  }

  // ───────────────────── ACCESS CLASSIFICATION ─────────────────────

  run.section("Access classification from source text (M21.5)");
  {
    const cases: Array<[string, string, string[]]> = [
      ["Enroll for free", "coursera", ["FREE_AUDIT", "UNKNOWN"]],
      ["Audit this course for free", "coursera", ["FREE_AUDIT"]],
      ["Free preview available", "coursera", ["UNKNOWN"]],
      ["Start your 7-day free trial", "coursera", ["FREE_TRIAL", "UNKNOWN"]],
      ["$49.99 to enroll", "udemy", ["PAID", "UNKNOWN"]],
    ];
    for (const [text, provider, allowed] of cases) {
      const result = classifyFreeStatusFromText(text);
      run.expect(
        `"${text}" → ${allowed.join(" or ")} (never FREE_FULL)`,
        allowed.includes(result.priceType) && result.priceType !== "FREE_FULL",
        `got ${result.priceType} (${result.rationale})`,
      );
      void provider;
    }

    run.expect(
      "'Enroll for free' alone never becomes FREE_FULL",
      classifyFreeStatusFromText("Enroll for free").priceType !== "FREE_FULL",
    );

    const preview = classifyAccessFromText({
      providerSlug: "coursera",
      text: "Free preview only",
    });
    run.expect(
      "the M21.5 classifier maps preview-only to FREE_PREVIEW",
      preview.access === "FREE_PREVIEW",
      preview.access,
    );

    // §11 applies to every provider, not just Coursera. A generic "free" must not
    // be read as full free access on a non-Coursera page either.
    const nonCourseraCases: Array<[string, string, string[]]> = [
      ["udemy", "Enroll for free", ["UNKNOWN", "FREE_AUDIT"]],
      ["udemy", "Free course", ["UNKNOWN"]],
      ["udemy", "Sign up free today", ["UNKNOWN"]],
      ["microsoft-learn", "miễn phí", ["UNKNOWN"]],
      ["udemy", "100% free forever", ["FREE_FULL"]],
      ["udemy", "Full course free", ["FREE_FULL"]],
      ["udemy", "Free preview", ["FREE_PREVIEW"]],
      ["udemy", "7-day free trial", ["FREE_TRIAL"]],
      ["udemy", "100% off with couponCode ABC", ["FREE_WITH_COUPON"]],
    ];
    for (const [provider, text, allowed] of nonCourseraCases) {
      const result = classifyAccessFromText({ providerSlug: provider, text });
      run.expect(
        `${provider} "${text}" → ${allowed.join(" or ")}`,
        allowed.includes(result.access),
        `got ${result.access}`,
      );
    }
    run.expect(
      "'Enroll for free' never yields FREE_FULL on any provider",
      ["udemy", "coursera", "edx", "microsoft-learn"].every(
        (p) =>
          classifyAccessFromText({ providerSlug: p, text: "Enroll for free" })
            .access !== "FREE_FULL",
      ),
    );

    run.expect(
      "certificate is resolved independently of access",
      classifyAccessFromText({
        providerSlug: "coursera",
        text: "Audit for free. Paid certificate available.",
      }).certificate === "PAID_CERTIFICATE",
    );
  }

  run.section("Access types are consistently gated across surfaces");
  {
    // "Miễn phí hôm nay" is the limited-time surface, so durable free types
    // belong to `isDurableFreeAccess` instead — they are two distinct surfaces,
    // not one eligibility list.
    const matrix: Array<[string, boolean, boolean, boolean]> = [
      // [priceType, freeListEligible, dailyFreeEligible, durableFree]
      ["FREE_FULL", true, false, true],
      ["FREE_AUDIT", true, false, true],
      ["FREE_WITH_COUPON", true, true, false],
      ["TEMPORARILY_FREE", true, true, false],
      ["FREE_PREVIEW", false, false, false],
      ["FREE_TRIAL", false, false, false],
      ["PAID", false, false, false],
    ];
    for (const [priceType, freeList, dailyFree, durable] of matrix) {
      run.expect(
        `${priceType}: free-list eligible = ${freeList}`,
        isEligibleForFreeLists(priceType as never) === freeList,
      );
      run.expect(
        `${priceType}: daily-free eligible = ${dailyFree}`,
        isDailyFreeEligibleAccess(priceType as never) === dailyFree,
      );
      run.expect(
        `${priceType}: durable-free = ${durable}`,
        isDurableFreeAccess(priceType as never) === durable,
      );
    }

    run.expect(
      "no free-deal surface admits preview or trial",
      isPreviewOrTrialOnly("FREE_PREVIEW") &&
        isPreviewOrTrialOnly("FREE_TRIAL") &&
        !isDailyFreeEligibleAccess("FREE_PREVIEW") &&
        !isDurableFreeAccess("FREE_TRIAL"),
    );

    run.expect(
      "FREE_PREVIEW badge copy never claims 100% free",
      !getAccessBadgeLabelVi("FREE_PREVIEW").includes("100%") &&
        !getPriceTypeLabel("FREE_PREVIEW", "vi").label.includes("100%"),
      `${getAccessBadgeLabelVi("FREE_PREVIEW")} / ${getPriceTypeLabel("FREE_PREVIEW", "vi").label}`,
    );
    run.expect(
      "FREE_TRIAL badge copy never claims permanent free",
      !/vĩnh viễn|lâu dài/i.test(getAccessBadgeLabelVi("FREE_TRIAL")),
      getAccessBadgeLabelVi("FREE_TRIAL"),
    );
    run.expect(
      "FREE_AUDIT copy states the certificate may cost money",
      /chứng chỉ/i.test(getAccessLabelVi("FREE_AUDIT")),
      getAccessLabelVi("FREE_AUDIT"),
    );
    run.expect(
      "certificate labels are a separate dimension from access",
      getCertificateLabelVi("PAID_CERTIFICATE") === "Chứng chỉ trả phí" &&
        getCertificateLabelVi("FREE_CERTIFICATE") === "Chứng chỉ miễn phí",
    );

    // Category and topic surfaces reuse queryCatalog, so a single assertion of
    // the shared filter covers all of them.
    const all = await listPublishedCoursesWithProvider(h.db, 100);
    run.expect(
      "listPublishedCoursesWithProvider excludes ineligible access types",
      all.every((c) => isEligibleForFreeLists(c.priceType)),
      all.map((c) => c.priceType).join(","),
    );
  }

  // ───────────────────── MULTI-DOMAIN DISCOVERY ─────────────────────

  run.section("Multi-domain taxonomy covers the 13 required domains");
  {
    const required = [
      "Công nghệ & IT",
      "Kinh doanh & Quản lý",
      "Tài chính",
      "Kỹ năng mềm",
      "Phát triển bản thân",
      "Cuộc sống & Sức khỏe",
      "Thiết kế & Sáng tạo",
      "Ngoại ngữ",
      "Văn phòng & Công việc",
      "Giáo dục",
      "Khoa học & Kỹ thuật",
      "Xã hội & Nhân văn",
      "Nghề nghiệp",
    ];
    const declared = M21_TAXONOMY_CATEGORIES.map((c) => c.nameVi);
    for (const domain of required) {
      run.expect(`taxonomy declares "${domain}"`, declared.includes(domain));
    }
  }

  run.section("Every domain can actually participate in discovery");
  {
    // A category row alone is not proof (§13): each domain needs at least one
    // enabled seed query, otherwise discovery can never reach it.
    const seededSlugs = new Set(SEED_CATEGORIES.map((c) => c.slug));
    const queriesByCategory = new Map<string, number>();
    for (const q of SEED_DISCOVERY_QUERIES) {
      queriesByCategory.set(
        q.category,
        (queriesByCategory.get(q.category) ?? 0) + 1,
      );
    }

    const starved: string[] = [];
    for (const slug of seededSlugs) {
      if ((queriesByCategory.get(slug) ?? 0) === 0) starved.push(slug);
    }
    run.expect(
      "no seeded category is left with zero discovery queries",
      starved.length === 0,
      starved.length ? `starved: ${starved.join(", ")}` : "all covered",
    );

    const counts = [...queriesByCategory.entries()].sort((a, b) => b[1] - a[1]);
    console.log(
      `      seed queries per category: ${counts
        .map(([c, n]) => `${c}=${n}`)
        .join(", ")}`,
    );
  }

  run.section("Discovery selection interleaves categories (M21.2 budget)");
  {
    await seedDiscoveryQueries(h.db, [
      ...Array.from({ length: 12 }, (_, i) => ({
        query: `programming query ${i}`,
        provider: "udemy",
        category: "programming",
      })),
      { query: "soft skills vi", provider: "udemy", category: "soft-skills" },
      { query: "design vi", provider: "udemy", category: "design" },
      { query: "finance vi", provider: "udemy", category: "finance" },
    ]);

    const due = await listDueDiscoveryQueries(h.db, 6);
    const categories = due.map((q) => q.category);
    const distinct = new Set(categories);

    run.expect(
      "a run does not consist solely of the largest category",
      distinct.size >= 3,
      `categories=${[...distinct].join(", ")}`,
    );
    run.expect(
      "thin categories are reached in the first run",
      distinct.has("design") && distinct.has("finance"),
      [...distinct].join(", "),
    );
    run.expect(
      "the budget limit is still respected",
      due.length === 6,
      `selected=${due.length}`,
    );

    run.expect(
      "interleave returns no duplicates",
      new Set(due.map((q) => q.id)).size === due.length,
    );

    // Pure-function edge cases the scheduler depends on.
    run.expect(
      "interleave with a single category still fills the budget",
      interleaveByCategory(
        Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, category: "ai" })),
        3,
      ).length === 3,
    );
  }

  run.section("Category coverage stats are written by real discovery runs");
  {
    const { bumpDiscoveryCategoryStats } = await import(
      "@/db/repositories/coupon-repository"
    );
    await bumpDiscoveryCategoryStats(h.db, "design", {
      queriesRun: 1,
      candidatesFound: 0,
      zeroCandidateRuns: 1,
    });
    await bumpDiscoveryCategoryStats(h.db, "programming", {
      queriesRun: 1,
      candidatesFound: 3,
      lastDiscoveredAt: new Date(),
    });
    await bumpDiscoveryCategoryStats(h.db, "programming", {
      verifiedCount: 1,
      publishedCount: 1,
    });

    const stats = await listDiscoveryCategoryStats(h.db);
    const design = stats.find((s) => s.categorySlug === "design");
    const programming = stats.find((s) => s.categorySlug === "programming");

    run.expect(
      "zero-candidate runs are recorded for a starved category",
      design?.zeroCandidateRuns === 1 && design?.candidatesFound === 0,
      JSON.stringify(design),
    );
    run.expect(
      "verified/published counters accumulate (was always 0 before)",
      programming?.verifiedCount === 1 && programming?.publishedCount === 1,
      JSON.stringify(programming),
    );
    run.expect(
      "repeated bumps accumulate rather than overwrite",
      programming?.queriesRun === 1 && programming?.candidatesFound === 3,
      JSON.stringify(programming),
    );
    run.expect(
      "stats are unique per category slug",
      new Set(stats.map((s) => s.categorySlug)).size === stats.length,
    );
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
