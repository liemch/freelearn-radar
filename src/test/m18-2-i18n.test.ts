import { describe, expect, it } from "vitest";

import { locales } from "@/lib/i18n/config";
import { localePath, stripLocalePrefix, switchLocalePath } from "@/lib/i18n/path";

describe("i18n path helpers", () => {
  it("builds locale-prefixed paths", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("vi", "/search")).toBe("/vi/search");
    expect(localePath("en", "/course/python-101")).toBe("/en/course/python-101");
  });

  it("strips locale prefix from pathname", () => {
    expect(stripLocalePrefix("/vi/search")).toEqual({
      locale: "vi",
      pathname: "/search",
    });
    expect(stripLocalePrefix("/en")).toEqual({
      locale: "en",
      pathname: "/",
    });
    expect(stripLocalePrefix("/search")).toEqual({
      locale: "vi",
      pathname: "/search",
    });
  });

  it("switches locale while preserving route", () => {
    expect(switchLocalePath("/en/course/ai-basics", "vi")).toBe(
      "/vi/course/ai-basics",
    );
    expect(switchLocalePath("/vi/search?q=python", "en")).toBe(
      "/en/search?q=python",
    );
  });

  it("supports both public locales", () => {
    expect(locales).toEqual(["en", "vi"]);
  });
});

describe("localized free status labels", () => {
  it("returns Vietnamese labels without enum leakage", async () => {
    const { getPriceTypeLabel, getCertificateTypeLabel } = await import(
      "@/domain/course/labels"
    );
    expect(getPriceTypeLabel("FREE_FULL", "vi").label).toBe("Miễn phí 100%");
    expect(getCertificateTypeLabel("FREE_CERTIFICATE", "vi")).toBe(
      "Chứng chỉ miễn phí",
    );
  });
});
