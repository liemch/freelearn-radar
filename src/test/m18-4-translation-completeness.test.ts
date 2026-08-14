import { describe, expect, it } from "vitest";

import { adminEn } from "@/lib/i18n/admin/en";
import { adminVi } from "@/lib/i18n/admin/vi";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { locales } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi } from "@/lib/i18n/dictionaries/vi";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  DURATION_BUCKETS,
  durationBucketLabel,
} from "@/domain/course/catalog-query";
import {
  TOPIC_LANDINGS,
  topicCopy,
} from "@/domain/discovery/topic-landings";
import { getPriceTypeLabel } from "@/domain/course/labels";
import { verificationAgeLabel } from "@/domain/verification/freshness-policy";

type Leaf = string | ((...args: never[]) => string);

/** Flatten a dictionary into `a.b.c` -> leaf so key sets can be compared. */
function flatten(value: unknown, prefix = ""): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  if (typeof value !== "object" || value === null) {
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string" || typeof child === "function") {
      out.set(path, child as Leaf);
    } else {
      for (const [nested, leaf] of flatten(child, path)) {
        out.set(nested, leaf);
      }
    }
  }
  return out;
}

const enFlat = flatten(en);
const viFlat = flatten(vi);
const adminEnFlat = flatten(adminEn);
const adminViFlat = flatten(adminVi);

describe("public dictionary completeness", () => {
  it("vi defines every key that en defines", () => {
    const missing = [...enFlat.keys()].filter((key) => !viFlat.has(key));
    expect(missing).toEqual([]);
  });

  it("en defines every key that vi defines", () => {
    const extra = [...viFlat.keys()].filter((key) => !enFlat.has(key));
    expect(extra).toEqual([]);
  });

  it("matching keys have matching leaf types", () => {
    const mismatched = [...enFlat.entries()]
      .filter(([key, value]) => typeof viFlat.get(key) !== typeof value)
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty = [...enFlat.entries(), ...viFlat.entries()]
      .filter(([, value]) => typeof value === "string" && value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("vi strings are actually translated, not copied from en", () => {
    // Proper nouns and shared tokens legitimately stay identical.
    const allowedIdentical = new Set([
      "language.en",
      "language.vi",
      "courseDetail.certificate",
      "courseDetail.language",
      "courseDetail.level",
      "courseDetail.provider",
      "courseDetail.duration",
      "meta.certificatesTitle",
    ]);

    const identical = [...enFlat.entries()]
      .filter(([key, value]) => {
        if (typeof value !== "string") return false;
        if (allowedIdentical.has(key)) return false;
        // Single tokens like "EN" are not meaningful translations.
        if (value.length <= 3) return false;
        return viFlat.get(key) === value;
      })
      .map(([key]) => key);

    expect(identical).toEqual([]);
  });
});

describe("admin dictionary completeness", () => {
  it("admin vi defines every key that admin en defines", () => {
    const missing = [...adminEnFlat.keys()].filter(
      (key) => !adminViFlat.has(key),
    );
    expect(missing).toEqual([]);
  });

  it("admin en defines every key that admin vi defines", () => {
    const extra = [...adminViFlat.keys()].filter(
      (key) => !adminEnFlat.has(key),
    );
    expect(extra).toEqual([]);
  });

  it("admin leaf types match", () => {
    const mismatched = [...adminEnFlat.entries()]
      .filter(([key, value]) => typeof adminViFlat.get(key) !== typeof value)
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("resolves a dictionary for every supported locale", () => {
    for (const locale of locales) {
      expect(getAdminDictionary(locale)).toBeDefined();
      expect(getDictionary(locale)).toBeDefined();
    }
  });

  it("admin vi differs from admin en for real sentences", () => {
    const identical = [...adminEnFlat.entries()]
      .filter(([key, value]) => {
        if (typeof value !== "string") return false;
        if (value.length <= 4) return false;
        if (key === "login.email" || key === "common.language") return false;
        return adminViFlat.get(key) === value;
      })
      .map(([key]) => key);

    expect(identical).toEqual([]);
  });
});

describe("bilingual content data", () => {
  it("every topic landing has en and vi copy", () => {
    for (const landing of TOPIC_LANDINGS) {
      for (const locale of locales) {
        const copy = topicCopy(landing, locale);
        expect(copy.title.trim()).not.toBe("");
        expect(copy.heading.trim()).not.toBe("");
        expect(copy.description.trim()).not.toBe("");
      }
    }
  });

  it("topic vi copy differs from en copy", () => {
    for (const landing of TOPIC_LANDINGS) {
      expect(landing.vi.heading).not.toBe(landing.en.heading);
      expect(landing.vi.description).not.toBe(landing.en.description);
    }
  });

  it("duration buckets resolve a localized label", () => {
    for (const bucket of Object.values(DURATION_BUCKETS)) {
      expect(durationBucketLabel(bucket, "en")).toBe(bucket.label);
      expect(durationBucketLabel(bucket, "vi")).toBe(bucket.labelVi);
      expect(bucket.labelVi).not.toBe(bucket.label);
    }
  });
});

describe("verification labels follow locale", () => {
  const now = new Date("2026-08-13T00:00:00Z");

  it("returns English labels by default", () => {
    expect(verificationAgeLabel(null, now)).toBe("Never verified");
    expect(verificationAgeLabel(new Date("2026-08-13T00:00:00Z"), now)).toBe(
      "Verified today",
    );
  });

  it("returns Vietnamese labels when given the vi dictionary", () => {
    expect(verificationAgeLabel(null, now, vi.verification)).toBe(
      "Chưa từng xác minh",
    );
    expect(
      verificationAgeLabel(new Date("2026-08-12T00:00:00Z"), now, vi.verification),
    ).toBe("Đã xác minh hôm qua");
    expect(
      verificationAgeLabel(new Date("2026-08-03T00:00:00Z"), now, vi.verification),
    ).toBe("Xác minh 10 ngày trước");
  });
});

describe("locale-sensitive helpers", () => {
  it("pluralizes counts per locale", () => {
    expect(en.common.courseCount(1)).toBe("1 course");
    expect(en.common.courseCount(3)).toBe("3 courses");
    expect(vi.common.courseCount(1)).toBe("1 khóa học");
    expect(vi.common.courseCount(3)).toBe("3 khóa học");
  });

  it("builds provider copy per locale", () => {
    expect(en.pages.providerHeading("Coursera")).toContain("Coursera");
    expect(vi.pages.providerHeading("Coursera")).toContain("Coursera");
    expect(vi.pages.providerHeading("Coursera")).not.toBe(
      en.pages.providerHeading("Coursera"),
    );
  });
});

/**
 * Regression: `dict.filters` is handed whole to the `CatalogFiltersForm` client
 * component. React cannot serialise a function across that boundary, so adding
 * a `(x) => string` entry here turns every page carrying filters into a 500 —
 * and neither typecheck nor build catches it, because both are perfectly valid
 * TypeScript. Only running the app reveals it.
 */
describe("client-serialisable dictionary slices", () => {
  const CLIENT_PASSED_SLICES = ["filters"] as const;

  it.each(CLIENT_PASSED_SLICES)(
    "keeps every value in dict.%s serialisable",
    (slice) => {
      for (const dict of [en, vi]) {
        const group = dict[slice] as Record<string, unknown>;
        for (const [key, value] of Object.entries(group)) {
          expect(
            typeof value,
            `${slice}.${key} must be a plain value; use a "{placeholder}" template instead of a function`,
          ).not.toBe("function");
        }
        expect(() => JSON.stringify(group)).not.toThrow();
      }
    },
  );
});

/**
 * FREE_AUDIT and FREE_TRIAL sit next to each other on the same badge and mean
 * opposite things: audit access does not expire, a trial does, and FREE_TRIAL is
 * excluded from free listings entirely (§66.4). A visitor who cannot tell the
 * two labels apart cannot act on either.
 */
describe("price labels distinguish audit from trial", () => {
  it.each(locales)("keeps the two labels distinct in %s", (locale) => {
    const audit = getPriceTypeLabel("FREE_AUDIT", locale).label;
    const trial = getPriceTypeLabel("FREE_TRIAL", locale).label;

    expect(audit).not.toBe(trial);
    expect(audit.toLowerCase()).not.toContain(trial.toLowerCase());
    expect(trial.toLowerCase()).not.toContain(audit.toLowerCase());
  });
});
