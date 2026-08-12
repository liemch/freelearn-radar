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

export type CatalogFilters = {
  q?: string;
  providerSlug?: string;
  level?: CourseLevel;
  language?: string;
  certificateType?: CertificateType;
  priceType?: PriceType;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;
export const MAX_PAGE = 200;

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

export function buildCatalogQuery(searchParams: URLSearchParams): CatalogFilters {
  return {
    q: searchParams.get("q")?.trim()?.slice(0, 200) || undefined,
    providerSlug: searchParams.get("provider") || undefined,
    level: (searchParams.get("level") as CourseLevel | null) || undefined,
    language: searchParams.get("language") || undefined,
    certificateType:
      (searchParams.get("certificate") as CertificateType | null) || undefined,
    priceType: (searchParams.get("price") as PriceType | null) || undefined,
    sort: parseCatalogSort(searchParams.get("sort") || undefined),
    page: parsePositiveInt(searchParams.get("page") || undefined, 1, MAX_PAGE),
    pageSize: DEFAULT_PAGE_SIZE,
  };
}
