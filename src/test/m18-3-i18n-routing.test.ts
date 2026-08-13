import { describe, expect, it } from "vitest";

import { currentBestPath } from "@/domain/discovery/monthly-collection";
import { locales } from "@/lib/i18n/config";
import {
  localePath,
  localizeHref,
  stripLocalePrefix,
  switchLocalePath,
} from "@/lib/i18n/path";
import { buildLocaleAlternates } from "@/lib/i18n/seo";

/**
 * M18.3 — locale persistence regression suite.
 * These assert the navigation contract used by LocalizedLink, forms,
 * language switcher, filters, pagination, and course/provider links.
 */

describe("locale persistence — homepage journeys", () => {
  it("EN homepage Explore stays EN", () => {
    const explore = localizeHref(currentBestPath(), "en");
    expect(explore.startsWith("/en/best/")).toBe(true);
  });

  it("VI homepage Explore stays VI", () => {
    const explore = localizeHref(currentBestPath(), "vi");
    expect(explore.startsWith("/vi/best/")).toBe(true);
  });

  it("VI homepage Categories stays VI", () => {
    expect(localizeHref("/free-courses/ai", "vi")).toBe("/vi/free-courses/ai");
  });

  it("VI homepage Search form action stays VI", () => {
    expect(localizeHref("/search", "vi")).toBe("/vi/search");
  });
});

describe("locale persistence — browse journeys", () => {
  it("VI → Category remains VI", () => {
    expect(localizeHref("/category/ai", "vi")).toBe("/vi/category/ai");
  });

  it("VI → Search remains VI", () => {
    expect(localizeHref("/search?q=Python", "vi")).toBe(
      "/vi/search?q=Python",
    );
  });

  it("VI Search → Filter remains VI", () => {
    expect(
      localizeHref("/search?q=python&level=BEGINNER", "vi"),
    ).toBe("/vi/search?q=python&level=BEGINNER");
  });

  it("VI Category → Course remains VI", () => {
    expect(localizeHref("/course/python-basics", "vi")).toBe(
      "/vi/course/python-basics",
    );
  });

  it("VI Course → Provider remains VI", () => {
    expect(localizeHref("/provider/coursera", "vi")).toBe(
      "/vi/provider/coursera",
    );
  });

  it("VI Course → Related Course remains VI", () => {
    expect(localizeHref("/course/related-ai", "vi")).toBe(
      "/vi/course/related-ai",
    );
  });

  it("VI pagination remains VI", () => {
    expect(localizeHref("/search?q=python&page=2", "vi")).toBe(
      "/vi/search?q=python&page=2",
    );
  });
});

describe("locale persistence — language switch", () => {
  it("VI language switch → EN same route", () => {
    expect(switchLocalePath("/vi/category/artificial-intelligence", "en")).toBe(
      "/en/category/artificial-intelligence",
    );
  });

  it("EN language switch → VI same route", () => {
    expect(switchLocalePath("/en/course/python-basics", "vi")).toBe(
      "/vi/course/python-basics",
    );
  });

  it("query parameters survive language switching", () => {
    expect(switchLocalePath("/vi/search?q=python&level=BEGINNER", "en")).toBe(
      "/en/search?q=python&level=BEGINNER",
    );
  });
});

describe("locale persistence — stale href repair", () => {
  it("rewrites stale EN hrefs when live locale is VI", () => {
    expect(localizeHref("/en/search", "vi")).toBe("/vi/search");
    expect(localizeHref("/en/course/foo", "vi")).toBe("/vi/course/foo");
    expect(localizeHref("/en/category/ai", "vi")).toBe("/vi/category/ai");
  });

  it("rewrites unprefixed category chips to live locale", () => {
    // Root cause of M18.3: CatalogFiltersForm used /category/... bare
    expect(localizeHref("/category/ai", "vi")).toBe("/vi/category/ai");
    expect(localizeHref("/category/ai", "en")).toBe("/en/category/ai");
  });

  it("does not localize admin, api, or outbound go routes", () => {
    expect(localizeHref("/admin/courses", "vi")).toBe("/admin/courses");
    expect(localizeHref("/api/health", "vi")).toBe("/api/health");
    expect(localizeHref("/course/foo/go", "vi")).toBe("/course/foo/go");
  });

  it("keeps external URLs untouched", () => {
    expect(localizeHref("https://coursera.org/learn/x", "vi")).toBe(
      "https://coursera.org/learn/x",
    );
  });
});

describe("locale precedence helpers", () => {
  it("supports both public locales", () => {
    expect(locales).toEqual(["en", "vi"]);
  });

  it("stripLocalePrefix reads explicit URL locale", () => {
    expect(stripLocalePrefix("/vi/search")).toEqual({
      locale: "vi",
      pathname: "/search",
    });
  });

  it("localePath builds prefixed routes", () => {
    expect(localePath("vi", "/")).toBe("/vi");
    expect(localePath("en", "/search")).toBe("/en/search");
  });

  it("hreflang alternates cover en, vi, and x-default", () => {
    const alt = buildLocaleAlternates("https://example.com", "vi", "/search");
    expect(alt.canonical).toBe("/vi/search");
    expect(alt.languages).toEqual({
      en: "https://example.com/en/search",
      vi: "https://example.com/vi/search",
      "x-default": "https://example.com/en/search",
    });
  });
});
