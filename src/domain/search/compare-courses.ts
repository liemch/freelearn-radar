import { searchThresholds } from "@/config/search-thresholds";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";
import type {
  CertificateType,
  FreeDurability,
  PriceType,
} from "@/domain/course/types";

export const COMPARE_COURSES_MAX = searchThresholds.compareCoursesMax;

export type ComparableCourse = {
  id: string;
  title: string;
  providerName: string;
  priceType: PriceType;
  certificateType: CertificateType;
  level: string;
  durationMinutes: number | null;
  language: string | null;
  freeDurability: FreeDurability | null;
};

export type ComparisonRowKey =
  | "title"
  | "provider"
  | "priceType"
  | "certificateType"
  | "level"
  | "duration"
  | "language"
  | "freeDurability";

export type ComparisonRow = {
  key: ComparisonRowKey;
  values: string[];
};

export type CourseComparison = {
  courses: ComparableCourse[];
  rows: ComparisonRow[];
};

/** Parse `compare=id1,id2,id3` (or `ids=`) from a query-string value. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Distinguishes a course id from a slug so compare can accept either form. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseCompareIds(
  raw: string | string[] | null | undefined,
): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of value.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= COMPARE_COURSES_MAX) break;
  }
  return ids;
}

/**
 * Facts-only comparison (plan §93.3): raw field values side by side,
 * no "best" or "recommended" judgment. Free-list-ineligible courses are
 * dropped before comparison.
 */
export function buildCourseComparison(
  courses: ComparableCourse[],
): CourseComparison {
  const eligible = courses
    .filter((course) => isEligibleForFreeLists(course.priceType))
    .slice(0, COMPARE_COURSES_MAX);

  const rows: ComparisonRow[] = [
    { key: "title", values: eligible.map((c) => c.title) },
    { key: "provider", values: eligible.map((c) => c.providerName) },
    { key: "priceType", values: eligible.map((c) => c.priceType) },
    {
      key: "certificateType",
      values: eligible.map((c) => c.certificateType),
    },
    { key: "level", values: eligible.map((c) => c.level) },
    {
      key: "duration",
      values: eligible.map((c) =>
        c.durationMinutes != null && c.durationMinutes > 0
          ? String(c.durationMinutes)
          : "UNKNOWN",
      ),
    },
    {
      key: "language",
      values: eligible.map((c) => c.language ?? "UNKNOWN"),
    },
    {
      key: "freeDurability",
      values: eligible.map((c) => c.freeDurability ?? "UNKNOWN"),
    },
  ];

  return { courses: eligible, rows };
}
