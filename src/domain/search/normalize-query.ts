import { createHash } from "node:crypto";

import { normalizeSearchQuery } from "@/domain/course/catalog-query";

export type SearchQueryLanguage =
  | "EN"
  | "VI"
  | "VI_NO_DIACRITIC"
  | "UNKNOWN";

const VI_DIACRITIC_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/** Common Vietnamese tokens often typed without diacritics. */
const VI_NO_DIACRITIC_HINTS = new Set([
  "khoa",
  "hoc",
  "mien",
  "phi",
  "co",
  "ban",
  "nguoi",
  "moi",
  "lap",
  "trinh",
  "du",
  "an",
  "quan",
  "ly",
  "tri",
  "tue",
  "nhan",
  "tao",
  "chung",
  "chi",
]);

export function hashSearchQuery(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

export function detectSearchQueryLanguage(
  normalized: string,
): SearchQueryLanguage {
  if (!normalized) return "UNKNOWN";
  if (VI_DIACRITIC_RE.test(normalized)) return "VI";

  const tokens = normalized
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const hintHits = tokens.filter((t) => VI_NO_DIACRITIC_HINTS.has(t)).length;
  if (hintHits >= 2) return "VI_NO_DIACRITIC";

  if (/[a-z]/i.test(normalized)) return "EN";
  return "UNKNOWN";
}

export type NormalizedSearchLog = {
  normalizedQuery: string | null;
  queryHash: string;
  queryLanguage: SearchQueryLanguage;
};

/**
 * Build a privacy-safe log payload from a raw public search string.
 * Empty / missing queries still get a stable empty-hash for filter-only pages.
 */
export function buildSearchLogFields(
  raw: string | null | undefined,
): NormalizedSearchLog {
  const normalized = normalizeSearchQuery(raw) ?? null;
  if (!normalized) {
    return {
      normalizedQuery: null,
      queryHash: hashSearchQuery(""),
      queryLanguage: "UNKNOWN",
    };
  }

  return {
    normalizedQuery: normalized.slice(0, 120),
    queryHash: hashSearchQuery(normalized.toLowerCase()),
    queryLanguage: detectSearchQueryLanguage(normalized),
  };
}
