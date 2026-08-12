import type {
  CertificateType,
  CourseLevel,
  PriceType,
} from "@/domain/course/types";

export type CatalogSort =
  | "recommended"
  | "newest"
  | "shortest"
  | "popular";

/** Deterministic duration buckets for collections/filters. */
export type DurationBucket = "under_1h" | "under_5h" | "weekend";

export type CatalogFilters = {
  q?: string;
  providerSlug?: string;
  level?: CourseLevel;
  language?: string;
  certificateType?: CertificateType;
  priceType?: PriceType;
  /** Inclusive max duration in minutes. */
  durationMaxMinutes?: number;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;
export const MAX_PAGE = 200;

export const DURATION_BUCKETS: Record<
  DurationBucket,
  { maxMinutes: number; label: string; slug: string }
> = {
  under_1h: { maxMinutes: 60, label: "Under 1 hour", slug: "under-1-hour" },
  under_5h: { maxMinutes: 300, label: "Under 5 hours", slug: "under-5-hours" },
  weekend: { maxMinutes: 480, label: "Weekend courses", slug: "weekend" },
};

export function durationBucketFromSlug(
  slug: string,
): DurationBucket | null {
  const entry = Object.entries(DURATION_BUCKETS).find(
    ([, value]) => value.slug === slug,
  );
  return (entry?.[0] as DurationBucket | undefined) ?? null;
}

/**
 * Normalize search text for Postgres ILIKE.
 * - trim, collapse whitespace
 * - strip control chars
 * - basic Vietnamese tone-insensitive expansion is NOT done (keep deterministic)
 * - truncate to 200
 */
export function normalizeSearchQuery(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned || undefined;
}

export function parseCatalogSort(value: string | undefined): CatalogSort {
  if (
    value === "newest" ||
    value === "shortest" ||
    value === "popular" ||
    value === "recommended"
  ) {
    return value;
  }

  return "recommended";
}

export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseDurationMax(
  value: string | null | undefined,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return Math.min(parsed, 10_000);
}

const LEVELS = new Set<CourseLevel>([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "ALL_LEVELS",
  "UNKNOWN",
]);

const CERTS = new Set<CertificateType>([
  "FREE_CERTIFICATE",
  "PAID_CERTIFICATE",
  "NO_CERTIFICATE",
  "UNKNOWN",
]);

const PRICES = new Set<PriceType>([
  "FREE_FULL",
  "FREE_AUDIT",
  "FREE_WITH_COUPON",
  "TEMPORARILY_FREE",
  "FREE_TRIAL",
  "PAID",
  "UNKNOWN",
]);

export function buildCatalogQuery(searchParams: URLSearchParams): CatalogFilters {
  const levelRaw = searchParams.get("level");
  const certRaw = searchParams.get("certificate");
  const priceRaw = searchParams.get("price");

  return {
    q: normalizeSearchQuery(searchParams.get("q")),
    providerSlug: searchParams.get("provider") || undefined,
    level:
      levelRaw && LEVELS.has(levelRaw as CourseLevel)
        ? (levelRaw as CourseLevel)
        : undefined,
    language: searchParams.get("language") || undefined,
    certificateType:
      certRaw && CERTS.has(certRaw as CertificateType)
        ? (certRaw as CertificateType)
        : undefined,
    priceType:
      priceRaw && PRICES.has(priceRaw as PriceType)
        ? (priceRaw as PriceType)
        : undefined,
    durationMaxMinutes: parseDurationMax(searchParams.get("durationMax")),
    sort: parseCatalogSort(searchParams.get("sort") || undefined),
    page: parsePositiveInt(searchParams.get("page") || undefined, 1, MAX_PAGE),
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/** Query params safe to preserve in pagination / shareable URLs. */
export function catalogFiltersToQuery(
  filters: CatalogFilters,
): Record<string, string | undefined> {
  return {
    q: filters.q,
    provider: filters.providerSlug,
    level: filters.level,
    price: filters.priceType,
    certificate: filters.certificateType,
    language: filters.language,
    durationMax:
      filters.durationMaxMinutes != null
        ? String(filters.durationMaxMinutes)
        : undefined,
    sort: filters.sort === "recommended" ? undefined : filters.sort,
  };
}
