/**
 * M21.6 — Course media resolver + SSRF-safe validation.
 * Missing image must not hide the course; fallback is branded, not fake official.
 */

import type {
  CourseImageSourceType,
  CourseImageStatus,
} from "@/domain/course/types";
import {
  fetchCourseImageSafely,
  validateImageUrl,
  type ImageFetchResult,
} from "@/services/images/course-image-service";

export type MediaResolveInput = {
  imageSourceUrl: string | null;
  imageStorageUrl: string | null;
  imagePolicy?: string | null;
  providerSlug?: string | null;
  categorySlug?: string | null;
};

export type MediaResolveResult = {
  imageResolvedUrl: string | null;
  imageSourceType: CourseImageSourceType;
  imageStatus: CourseImageStatus;
  imageWidth: number | null;
  imageHeight: number | null;
  imageHash: string | null;
  imageFallbackReason: string | null;
  imageCheckedAt: Date;
};

const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;

export function classifyFallbackSourceType(params: {
  providerSlug?: string | null;
  categorySlug?: string | null;
}): CourseImageSourceType {
  if (params.categorySlug) return "CATEGORY_FALLBACK";
  if (params.providerSlug) return "PROVIDER_FALLBACK";
  return "NONE";
}

/**
 * Pure decision after a fetch attempt (or skip). Does not invent official thumbs.
 */
export function resolveMediaStatus(params: {
  sourceUrl: string | null;
  storageUrl: string | null;
  fetchResult: ImageFetchResult | null;
  providerSlug?: string | null;
  categorySlug?: string | null;
  width?: number | null;
  height?: number | null;
}): MediaResolveResult {
  const checkedAt = new Date();
  const preferred = params.storageUrl ?? params.sourceUrl;

  if (!preferred) {
    return {
      imageResolvedUrl: null,
      imageSourceType: classifyFallbackSourceType(params),
      imageStatus: "FALLBACK",
      imageWidth: null,
      imageHeight: null,
      imageHash: null,
      imageFallbackReason: "missing_source",
      imageCheckedAt: checkedAt,
    };
  }

  if (!validateImageUrl(preferred)) {
    return {
      imageResolvedUrl: null,
      imageSourceType: classifyFallbackSourceType(params),
      imageStatus: "BLOCKED",
      imageWidth: null,
      imageHeight: null,
      imageHash: null,
      imageFallbackReason: "ssrf_or_invalid_url",
      imageCheckedAt: checkedAt,
    };
  }

  if (!params.fetchResult) {
    // Remote-only path: accept URL as PENDING/OK without fetch when policy says so.
    return {
      imageResolvedUrl: preferred,
      imageSourceType: params.storageUrl ? "CACHED" : "TRUSTED_METADATA",
      imageStatus: "PENDING",
      imageWidth: params.width ?? null,
      imageHeight: params.height ?? null,
      imageHash: null,
      imageFallbackReason: null,
      imageCheckedAt: checkedAt,
    };
  }

  if (!params.fetchResult.ok) {
    const reason = params.fetchResult.reason;
    const status: CourseImageStatus =
      reason === "invalid_url" || reason === "private_host"
        ? "BLOCKED"
        : "BROKEN";
    return {
      imageResolvedUrl: null,
      imageSourceType: classifyFallbackSourceType(params),
      imageStatus: status,
      imageWidth: null,
      imageHeight: null,
      imageHash: null,
      imageFallbackReason: reason,
      imageCheckedAt: checkedAt,
    };
  }

  const width = params.width ?? null;
  const height = params.height ?? null;
  if (
    (width != null && (width < MIN_DIMENSION || width > MAX_DIMENSION)) ||
    (height != null && (height < MIN_DIMENSION || height > MAX_DIMENSION))
  ) {
    return {
      imageResolvedUrl: null,
      imageSourceType: classifyFallbackSourceType(params),
      imageStatus: "FALLBACK",
      imageWidth: width,
      imageHeight: height,
      imageHash: null,
      imageFallbackReason: "unreasonable_dimensions",
      imageCheckedAt: checkedAt,
    };
  }

  return {
    imageResolvedUrl: params.fetchResult.finalUrl,
    imageSourceType: params.storageUrl ? "CACHED" : "OFFICIAL",
    imageStatus: "OK",
    imageWidth: width,
    imageHeight: height,
    imageHash: null,
    imageFallbackReason: null,
    imageCheckedAt: checkedAt,
  };
}

export async function resolveCourseMedia(
  input: MediaResolveInput,
  options?: {
    fetchImpl?: typeof fetch;
    validateRemote?: boolean;
  },
): Promise<MediaResolveResult> {
  const preferred = input.imageStorageUrl ?? input.imageSourceUrl;
  if (!preferred) {
    return resolveMediaStatus({
      sourceUrl: null,
      storageUrl: null,
      fetchResult: null,
      providerSlug: input.providerSlug,
      categorySlug: input.categorySlug,
    });
  }

  if (options?.validateRemote) {
    const fetchResult = await fetchCourseImageSafely(
      preferred,
      options.fetchImpl ?? fetch,
    );
    return resolveMediaStatus({
      sourceUrl: input.imageSourceUrl,
      storageUrl: input.imageStorageUrl,
      fetchResult,
      providerSlug: input.providerSlug,
      categorySlug: input.categorySlug,
    });
  }

  return resolveMediaStatus({
    sourceUrl: input.imageSourceUrl,
    storageUrl: input.imageStorageUrl,
    fetchResult: null,
    providerSlug: input.providerSlug,
    categorySlug: input.categorySlug,
  });
}

export type MediaQualityCounts = {
  total: number;
  withThumbnail: number;
  official: number;
  fallback: number;
  broken: number;
  missing: number;
  blocked: number;
};

export function summarizeMediaQuality(
  rows: Array<{ imageStatus: CourseImageStatus; imageSourceType: CourseImageSourceType }>,
): MediaQualityCounts {
  const counts: MediaQualityCounts = {
    total: rows.length,
    withThumbnail: 0,
    official: 0,
    fallback: 0,
    broken: 0,
    missing: 0,
    blocked: 0,
  };
  for (const row of rows) {
    if (row.imageStatus === "OK" || row.imageStatus === "PENDING") {
      counts.withThumbnail += 1;
    }
    if (row.imageSourceType === "OFFICIAL" || row.imageSourceType === "CACHED") {
      counts.official += 1;
    }
    if (row.imageStatus === "FALLBACK") counts.fallback += 1;
    if (row.imageStatus === "BROKEN") counts.broken += 1;
    if (row.imageStatus === "MISSING") counts.missing += 1;
    if (row.imageStatus === "BLOCKED") counts.blocked += 1;
  }
  return counts;
}
