/**
 * Verification 05 — public and admin surfaces over real HTTP.
 *
 * The application runs unmodified (`next start`) against the verification
 * Postgres, so every assertion here covers the true request path: middleware →
 * page/route → service → SQL → rendered HTML.
 */

import "@/lib/load-env";

import { CheckRun } from "./pg-harness";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./http-fixtures";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";

type Fetched = {
  status: number;
  body: string;
  headers: Headers;
  location: string | null;
};

async function get(
  pathname: string,
  init?: RequestInit & { follow?: boolean },
): Promise<Fetched> {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: init?.follow ? "follow" : "manual",
    ...init,
  });
  const body = await response.text().catch(() => "");
  return {
    status: response.status,
    body,
    headers: response.headers,
    location: response.headers.get("location"),
  };
}

/** Strips tags so copy assertions are not fooled by attribute values. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function hasRuntimeError(html: string): boolean {
  return (
    /Application error|Internal Server Error|digest:|Unhandled Runtime Error/i.test(
      html,
    ) || /__NEXT_ERROR_CODE/.test(html)
  );
}

async function main(): Promise<number> {
  const run = new CheckRun();

  run.section("Server reachable");
  {
    const health = await get("/api/health");
    run.expect(
      "health endpoint responds",
      health.status === 200,
      `status=${health.status} body=${health.body.slice(0, 200)}`,
    );

    // The database probe is opt-in via ?deep=1 so the shallow check stays cheap.
    const deep = await get("/api/health?deep=1");
    run.expect(
      "deep health reports the database as reachable",
      deep.status === 200 && /"database"\s*:\s*"ok"/.test(deep.body),
      deep.body.slice(0, 300),
    );
  }

  run.section("Locale routing and Vietnamese-only direction");
  {
    const root = await get("/");
    run.expect(
      "unprefixed / redirects to a locale",
      root.status >= 300 && root.status < 400 && Boolean(root.location),
      `status=${root.status} location=${root.location}`,
    );
    run.expect(
      "the default locale is Vietnamese",
      (root.location ?? "").includes("/vi"),
      String(root.location),
    );

    const vi = await get("/vi");
    run.expect("/vi renders 200", vi.status === 200, `status=${vi.status}`);
    run.expect("/vi has no runtime error", !hasRuntimeError(vi.body));
    run.expect(
      "server-rendered html lang is vi (crawlers and screen readers read this)",
      /<html[^>]+lang="vi"/.test(vi.body),
      (vi.body.match(/<html[^>]*>/) ?? ["none"])[0],
    );
    run.expect(
      "no language switcher is rendered",
      !/aria-label="[^"]*[Ll]anguage|switch-locale|LanguageSwitcher/.test(
        vi.body,
      ),
    );
    run.expect(
      "no /en link appears in public navigation",
      !/href="\/en[/"]/.test(vi.body),
      (vi.body.match(/href="\/en[^"]*"/g) ?? []).slice(0, 3).join(", "),
    );

    const canonical = vi.body.match(
      /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/,
    );
    run.expect(
      "canonical points at the Vietnamese route",
      Boolean(canonical) && canonical![1]!.includes("/vi"),
      canonical?.[1] ?? "missing",
    );
    run.expect(
      "no English hreflang alternate is advertised",
      !/hreflang="en"/.test(vi.body),
      (vi.body.match(/hreflang="[^"]*"/g) ?? []).join(", "),
    );
  }

  run.section("Homepage content comes from the database");
  {
    const vi = await get("/vi");
    const text = visibleText(vi.body);
    run.expect(
      "a seeded course title is rendered",
      text.includes("Khóa học Python cho người mới"),
      "looked for the seeded Vietnamese course title",
    );
    run.expect(
      "an ineligible PAID course is not rendered",
      !text.includes("Advanced Python Masterclass"),
    );
    run.expect(
      "an ineligible FREE_TRIAL course is not rendered",
      !text.includes("Python Bootcamp Free Trial"),
    );
    run.expect(
      "an ineligible FREE_PREVIEW course is not rendered",
      !text.includes("Python Preview Only Course"),
    );
    run.expect(
      "an unpublished DRAFT course is not rendered",
      !text.includes("Draft Course Not Live"),
    );
    run.expect(
      "official English course titles are preserved, not translated",
      text.includes("AI for Beginners") ||
        text.includes("Project Management Fundamentals"),
    );
  }

  run.section("Search page over HTTP");
  {
    const cases: Array<[string, string, string]> = [
      ["python", "python-cho-nguoi-moi", "keyword"],
      ["khóa học python", "python-cho-nguoi-moi", "VI accented"],
      ["khoa hoc python", "python-cho-nguoi-moi", "VI unaccented"],
      ["pyton", "python", "typo tolerance"],
      ["excel co ban", "excel-co-ban-mien-phi", "VI unaccented short"],
      ["quan ly du an", "project-management-fundamentals", "VI→EN concept"],
      ["ms learn", "microsoft", "provider alias"],
    ];

    for (const [query, expectFragment, label] of cases) {
      const page = await get(`/vi/search?q=${encodeURIComponent(query)}`);
      run.expect(
        `search "${query}" (${label}) renders 200`,
        page.status === 200 && !hasRuntimeError(page.body),
        `status=${page.status}`,
      );
      run.expect(
        `search "${query}" (${label}) returns a relevant result`,
        page.body.includes(expectFragment),
        `expected to find "${expectFragment}"`,
      );
    }

    // The results heading echoes the query, so presence of the title in the text
    // proves nothing. Course links are the real signal.
    const paid = await get("/vi/search?q=Advanced%20Python%20Masterclass");
    const paidLinks = paid.body.match(/href="\/vi\/course\/[^"]+"/g) ?? [];
    run.expect(
      "a PAID course is never linked from search results",
      !paidLinks.some((href) => href.includes("advanced-python-masterclass")),
      `links=${[...new Set(paidLinks)].join(", ") || "none"}`,
    );

    const trialFilter = await get("/vi/search?price=FREE_TRIAL");
    run.expect(
      "?price=FREE_TRIAL surfaces no trial course",
      !visibleText(trialFilter.body).includes("Python Bootcamp Free Trial"),
    );

    const empty = await get(
      "/vi/search?q=" + encodeURIComponent("khóa học kế toán thuế nâng cao"),
    );
    run.expect(
      "an unanswerable query renders an honest Vietnamese empty state",
      empty.status === 200 &&
        /Không tìm thấy|chưa có|Không có/i.test(visibleText(empty.body)),
      visibleText(empty.body).slice(0, 200),
    );
    run.expect(
      "the empty state is not an error page",
      !hasRuntimeError(empty.body),
    );

    const filtered = await get("/vi/search?q=python&level=BEGINNER");
    run.expect(
      "search with filters renders 200",
      filtered.status === 200 && !hasRuntimeError(filtered.body),
    );
    run.expect(
      "filtered search URLs are noindex (§103)",
      /noindex/i.test(filtered.body),
      "expected robots noindex on a filtered query URL",
    );

    const page2 = await get("/vi/search?q=python&page=2");
    run.expect(
      "search page 2 renders without error",
      page2.status === 200 && !hasRuntimeError(page2.body),
      `status=${page2.status}`,
    );

    const injection = await get(
      "/vi/search?q=" + encodeURIComponent('<script>alert(1)</script>'),
    );
    run.expect(
      "a script tag in the query is not reflected unescaped (XSS)",
      !injection.body.includes("<script>alert(1)</script>"),
    );
    run.expect(
      "the injection attempt still renders a normal page",
      injection.status === 200 && !hasRuntimeError(injection.body),
    );

    const sqlish = await get(
      "/vi/search?q=" + encodeURIComponent("python' OR 1=1--"),
    );
    run.expect(
      "a SQL-ish query is handled as text, not executed",
      sqlish.status === 200 && !hasRuntimeError(sqlish.body),
      `status=${sqlish.status}`,
    );
  }

  run.section('"Miễn phí hôm nay" over HTTP');
  {
    const page = await get("/vi/mien-phi-hom-nay");
    const text = visibleText(page.body);
    run.expect(
      "daily-free page renders 200",
      page.status === 200 && !hasRuntimeError(page.body),
      `status=${page.status}`,
    );
    run.expect(
      "the live verified 100%-off course is shown",
      text.includes("Graphic Design with Canva"),
      text.slice(0, 300),
    );
    run.expect(
      "the verified coupon badge is rendered",
      /Giảm 100% bằng coupon|Coupon 100%/.test(text),
      "expected the verified coupon badge",
    );
    run.expect(
      "the expired offer's course is not presented as a coupon deal",
      !/Excel cơ bản miễn phí[\s\S]{0,120}(Giảm 100% bằng coupon)/.test(text),
    );
    run.expect(
      "real verification freshness is displayed",
      /Xác minh|Vừa xác minh/.test(text),
      "expected a freshness string derived from verified_at",
    );
    run.expect(
      "the coupon CTA is present for the verified offer",
      /Nhận khóa học miễn phí/.test(text),
    );
    run.expect(
      "page copy is Vietnamese",
      /Miễn phí hôm nay|miễn phí/i.test(text) &&
        !/No free deals today/i.test(text),
    );
  }

  run.section("Course detail, category, topic");
  {
    const detail = await get("/vi/course/python-cho-nguoi-moi");
    run.expect(
      "course detail renders 200",
      detail.status === 200 && !hasRuntimeError(detail.body),
      `status=${detail.status}`,
    );
    const detailText = visibleText(detail.body);
    run.expect(
      "course detail shows the course title",
      detailText.includes("Khóa học Python cho người mới"),
    );
    run.expect(
      "course detail has an outbound CTA route",
      detail.body.includes("/course/python-cho-nguoi-moi/go"),
    );
    const ldBlocks = [
      ...detail.body.matchAll(
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => m[1]!);
    run.expect(
      "JSON-LD blocks are emitted",
      ldBlocks.length > 0,
      `blocks=${ldBlocks.length}`,
    );
    run.expect(
      "every JSON-LD block parses as JSON and contains no raw angle brackets",
      ldBlocks.every((block) => {
        if (/[<>]/.test(block)) return false;
        try {
          JSON.parse(block);
          return true;
        } catch {
          return false;
        }
      }),
    );
    run.expect(
      "related section never lists an ineligible course",
      !detailText.includes("Advanced Python Masterclass") &&
        !detailText.includes("Python Bootcamp Free Trial") &&
        !detailText.includes("Python Preview Only Course"),
    );

    const unpublished = await get("/vi/course/draft-course-not-live");
    run.expect(
      "a DRAFT course title never leaks into metadata or content",
      !unpublished.body.includes("Draft Course Not Live"),
      (unpublished.body.match(/<title>[^<]*<\/title>/) ?? ["none"])[0],
    );
    run.expect(
      "a DRAFT course renders the not-found surface",
      /Không tìm thấy/.test(visibleText(unpublished.body)) ||
        unpublished.status === 404,
      `status=${unpublished.status}`,
    );
    run.expect(
      "a DRAFT course URL is marked noindex",
      /noindex/i.test(unpublished.body),
    );

    const missing = await get("/vi/course/this-slug-does-not-exist");
    run.expect(
      "a missing course does not 500",
      missing.status !== 500 && !hasRuntimeError(missing.body),
      `status=${missing.status}`,
    );
    run.expect(
      "a missing course URL is marked noindex so a soft 404 cannot be indexed",
      /noindex/i.test(missing.body),
      `status=${missing.status}`,
    );

    const missingCategory = await get("/vi/category/does-not-exist");
    run.expect(
      "a missing category URL is marked noindex (§103 thin-page guard)",
      /noindex/i.test(missingCategory.body),
      `status=${missingCategory.status}`,
    );

    const category = await get("/vi/category/programming");
    run.expect(
      "category page renders 200 with real courses",
      category.status === 200 &&
        !hasRuntimeError(category.body) &&
        visibleText(category.body).includes("Python"),
      `status=${category.status}`,
    );

    const emptyCategory = await get("/vi/category/finance");
    run.expect(
      "a category with no courses renders an empty state, not an error",
      emptyCategory.status === 200 && !hasRuntimeError(emptyCategory.body),
      `status=${emptyCategory.status}`,
    );

    const topic = await get("/vi/free-courses/ai");
    run.expect(
      "topic landing renders 200",
      topic.status === 200 && !hasRuntimeError(topic.body),
      `status=${topic.status}`,
    );
  }

  run.section("Decision surfaces (flag-gated)");
  {
    for (const [pathname, label] of [
      ["/vi/compare?compare=python-cho-nguoi-moi,ai-for-beginners", "compare"],
      ["/vi/path", "learning path"],
      ["/vi/tracker", "tracker"],
    ] as const) {
      const page = await get(pathname);
      run.expect(
        `${label} renders without a runtime error`,
        (page.status === 200 || page.status === 404) &&
          !hasRuntimeError(page.body),
        `status=${page.status}`,
      );
    }
  }

  run.section("SEO surfaces");
  {
    const sitemap = await get("/sitemap.xml");
    run.expect(
      "sitemap renders 200",
      sitemap.status === 200,
      `status=${sitemap.status}`,
    );
    run.expect(
      "sitemap contains Vietnamese URLs",
      sitemap.body.includes("/vi/"),
    );
    run.expect(
      "sitemap contains no /en/ URLs",
      !sitemap.body.includes("/en/"),
      (sitemap.body.match(/https?:\/\/[^<]*\/en\/[^<]*/g) ?? [])
        .slice(0, 3)
        .join(", "),
    );
    run.expect(
      "sitemap includes the daily-free surface",
      sitemap.body.includes("/mien-phi-hom-nay"),
    );
    run.expect(
      "sitemap lists real course URLs from the database",
      sitemap.body.includes("python-cho-nguoi-moi"),
    );

    const robots = await get("/robots.txt");
    run.expect("robots renders 200", robots.status === 200);
    run.expect(
      "robots disallows admin and api",
      robots.body.includes("/admin") && robots.body.includes("/api"),
    );

    // M20.14 §116.2: system-generated SEO metadata is Vietnamese too.
    const englishTitle = /<title>[^<]*(Free Courses|Best Free Online Courses|Search Free Courses)[^<]*<\/title>/;
    for (const [pathname, label] of [
      ["/vi/category/programming", "category"],
      ["/vi/collections/under-1-hour", "collection"],
      ["/vi/best/2026/08", "monthly best"],
      ["/vi/search", "search"],
    ] as const) {
      const page = await get(pathname);
      run.expect(
        `${label} metadata title is Vietnamese, not English`,
        !englishTitle.test(page.body),
        (page.body.match(/<title>[^<]*<\/title>/) ?? ["none"])[0],
      );
    }
  }

  run.section("Outbound course click");
  {
    const go = await get("/course/python-cho-nguoi-moi/go");
    run.expect(
      "outbound redirects (302/307)",
      go.status >= 300 && go.status < 400,
      `status=${go.status}`,
    );
    run.expect(
      "outbound target is the provider URL",
      (go.location ?? "").includes("udemy.com"),
      String(go.location),
    );
  }

  run.section("Affiliate outbound — open redirect (P0 regression)");
  {
    const hostile = [
      "/evil.com",
      "//evil.com",
      "///evil.com",
      "http://evil.com",
      "\\\\evil.com",
    ];
    for (const locale of hostile) {
      const response = await get(
        `/go/affiliate?campaign=verify-course&locale=${encodeURIComponent(locale)}`,
      );
      const target = response.location ?? "";
      const leaves =
        target.includes("evil.com") ||
        (target.startsWith("http") && !target.includes("localhost:3100"));
      run.expect(
        `locale="${locale}" cannot redirect off-origin`,
        !leaves,
        `location=${target}`,
      );
    }

    const noCampaign = await get("/go/affiliate");
    run.expect(
      "a missing campaign redirects on-origin instead of erroring",
      noCampaign.status >= 300 &&
        noCampaign.status < 400 &&
        !(noCampaign.location ?? "").includes("evil"),
      `status=${noCampaign.status} location=${noCampaign.location}`,
    );
  }

  run.section("Monetization kill switch (FEATURE_MONETIZATION unset)");
  {
    const affiliate = await get("/go/affiliate?campaign=verify-course");
    run.expect(
      "affiliate hop does not leave the origin while monetization is off",
      !(affiliate.location ?? "").includes("coursera.org"),
      `location=${affiliate.location}`,
    );
    run.expect(
      "affiliate hop still redirects rather than erroring",
      affiliate.status >= 300 && affiliate.status < 400,
      `status=${affiliate.status}`,
    );

    const detail = await get("/vi/course/python-cho-nguoi-moi");
    run.expect(
      "no affiliate disclosure is rendered while monetization is off",
      !visibleText(detail.body).includes("Liên kết tiếp thị"),
    );
    run.expect(
      "normal course outbound still works while monetization is off",
      (await get("/course/python-cho-nguoi-moi/go")).status >= 300,
    );
  }

  run.section("Admin RBAC over HTTP");
  {
    for (const pathname of [
      "/admin",
      "/admin/courses",
      "/admin/coupons",
      "/admin/coverage",
      "/admin/media-quality",
      "/admin/taxonomy",
      "/admin/users",
      "/admin/analytics",
      "/admin/search",
      "/admin/embeddings",
      "/admin/monetization",
      "/admin/candidates",
      "/admin/discovery",
      "/admin/providers",
    ]) {
      const page = await get(pathname);
      const redirectedToLogin =
        page.status >= 300 &&
        page.status < 400 &&
        (page.location ?? "").includes("/admin/login");
      run.expect(
        `${pathname} is not readable anonymously`,
        redirectedToLogin || page.status === 401 || page.status === 404,
        `status=${page.status} location=${page.location}`,
      );
    }

    for (const [pathname, method] of [
      ["/api/admin/courses", "POST"],
      ["/api/admin/candidates/bulk", "POST"],
      ["/api/admin/discovery/run", "POST"],
      ["/api/admin/embeddings", "POST"],
      ["/api/admin/search/benchmark", "POST"],
      ["/api/admin/url-shape", "POST"],
      ["/api/admin/ai/diagnose", "POST"],
    ] as const) {
      const response = await get(pathname, {
        method,
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      run.expect(
        `${method} ${pathname} rejects an anonymous mutation`,
        response.status === 401 ||
          response.status === 403 ||
          (response.status >= 300 && response.status < 400),
        `status=${response.status}`,
      );
    }
  }

  run.section("Cron routes require the shared secret");
  {
    for (const pathname of [
      "/api/cron/coupons",
      "/api/cron/discover",
      "/api/cron/embed",
      "/api/cron/monitor",
      "/api/cron/verify",
    ]) {
      const unauth = await get(pathname);
      run.expect(
        `${pathname} rejects an unauthenticated call`,
        unauth.status === 401,
        `status=${unauth.status}`,
      );
    }

    const authorized = await get("/api/cron/coupons", {
      headers: { authorization: "Bearer verification-only-cron-secret" },
    });
    run.expect(
      "the coupon cron runs when authorized",
      authorized.status === 200,
      `status=${authorized.status} body=${authorized.body.slice(0, 200)}`,
    );
    run.expect(
      "the coupon cron reports the coupon flag as off (default deploy state)",
      authorized.body.includes("FEATURE_COUPON_DISCOVERY_off"),
      authorized.body.slice(0, 300),
    );
    run.expect(
      "the media pass runs independently of the coupon flag",
      authorized.body.includes("media"),
      authorized.body.slice(0, 300),
    );
  }

  run.section("Admin login and an authenticated admin walkthrough");
  {
    const login = await fetch(`${BASE}/api/admin/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      redirect: "manual",
    });
    const loginBody = await login.text();
    run.expect(
      "admin login succeeds with the seeded credentials",
      login.status === 200,
      `status=${login.status} body=${loginBody.slice(0, 200)}`,
    );

    const setCookie = login.headers.get("set-cookie") ?? "";
    run.expect(
      "session cookie is HttpOnly and SameSite=Lax",
      /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie),
      setCookie.slice(0, 200),
    );

    const cookie = setCookie.split(";")[0] ?? "";
    if (!cookie) {
      run.expect("session cookie present for admin walkthrough", false);
      return run.summary();
    }

    const authed = async (pathname: string) =>
      get(pathname, { headers: { cookie } });

    const pages: Array<[string, string[]]> = [
      ["/admin", []],
      ["/admin/courses", ["Khóa học Python"]],
      ["/admin/coupons", ["VERIFYLIVE"]],
      ["/admin/coverage", []],
      ["/admin/media-quality", []],
      ["/admin/taxonomy", []],
      ["/admin/users", [ADMIN_EMAIL]],
      ["/admin/analytics", []],
      ["/admin/search", []],
      ["/admin/embeddings", []],
      ["/admin/monetization", []],
      ["/admin/candidates", []],
      ["/admin/discovery", []],
      ["/admin/providers", ["Udemy"]],
    ];

    for (const [pathname, expected] of pages) {
      const page = await authed(pathname);
      run.expect(
        `${pathname} renders 200 for an admin`,
        page.status === 200 && !hasRuntimeError(page.body),
        `status=${page.status}`,
      );
      for (const fragment of expected) {
        run.expect(
          `${pathname} shows real data ("${fragment}")`,
          visibleText(page.body).includes(fragment),
          `did not find "${fragment}"`,
        );
      }
    }

    const adminHome = await authed("/admin");
    run.expect(
      "admin chrome is Vietnamese",
      /Tổng quan|Khóa học|Thống kê|Quản trị/.test(visibleText(adminHome.body)),
    );
    run.expect(
      "admin pages are noindex",
      /noindex/i.test(adminHome.body),
    );

    const coupons = await authed("/admin/coupons");
    const couponText = visibleText(coupons.body);
    run.expect(
      "admin coupons shows the active offer count from the database",
      couponText.includes("VERIFYLIVE") || /ACTIVE_100_OFF|100%/.test(couponText),
      couponText.slice(0, 300),
    );

    const coverage = await authed("/admin/coverage");
    const coverageText = visibleText(coverage.body);
    run.expect(
      "admin coverage lists never-run categories (not just rows with stats)",
      coverageText.includes("design") || coverageText.includes("finance"),
      coverageText.slice(0, 300),
    );

    const media = await authed("/admin/media-quality");
    run.expect(
      "admin media quality renders real counts",
      media.status === 200 && !hasRuntimeError(media.body),
    );

    // An EDITOR-only surface must still refuse a non-admin action; verify the
    // admin-only user route accepts the ADMIN session but rejects a bad payload
    // rather than mass-assigning.
    const badPatch = await fetch(`${BASE}/api/admin/users/not-a-uuid`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ role: "SUPERUSER", email: "x@y.z" }),
      redirect: "manual",
    });
    run.expect(
      "an invalid role is rejected rather than mass-assigned",
      badPatch.status === 400 || badPatch.status === 404 || badPatch.status === 422,
      `status=${badPatch.status}`,
    );

    const logout = await fetch(`${BASE}/api/admin/auth/logout`, {
      method: "POST",
      headers: { cookie },
      redirect: "manual",
    });
    run.expect(
      "logout succeeds",
      logout.status === 200 || (logout.status >= 300 && logout.status < 400),
      `status=${logout.status}`,
    );
  }

  run.section("Admin login rate limiting");
  {
    let sawLimit = false;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const response = await fetch(`${BASE}/api/admin/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "attacker@example.com",
          password: `wrong-${attempt}`,
        }),
        redirect: "manual",
      });
      if (response.status === 429) {
        sawLimit = true;
        break;
      }
    }
    run.expect(
      "repeated failed logins are rate limited",
      sawLimit,
      "expected a 429 within 14 attempts",
    );
  }

  run.section("No public endpoint proxies arbitrary URLs or vectors");
  {
    const probes = [
      "/api/admin/url-shape",
      "/api/embed",
      "/api/embedding",
      "/api/ai",
      "/api/image",
      "/api/proxy",
    ];
    for (const pathname of probes) {
      const response = await get(pathname, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data" }),
      });
      run.expect(
        `${pathname} is not an open fetch/embedding proxy`,
        response.status === 401 ||
          response.status === 403 ||
          response.status === 404 ||
          response.status === 405 ||
          (response.status >= 300 && response.status < 400),
        `status=${response.status}`,
      );
    }
  }

  return run.summary();
}

main()
  .then((failed) => process.exit(failed === 0 ? 0 : 1))
  .catch((error) => {
    console.error("harness error:", error);
    process.exit(1);
  });
