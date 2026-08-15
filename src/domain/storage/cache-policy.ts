import type { ManagedAssetType } from "@/db/schema/managed-assets";

export type CacheDecisionInput = {
  imageSourceType: string | null;
  imagePolicy: string | null;
  imageStatus: string | null;
  sourceUrl: string | null;
  failureCount?: number;
  manualRequest?: boolean;
};

export type CacheDecision =
  | { action: "KEEP_REMOTE"; reason: string }
  | { action: "CACHE"; reason: string; assetType: ManagedAssetType };

/**
 * Deterministic cache policy — never AI, never mirror whole catalogs.
 */
export function shouldCacheCourseImage(
  input: CacheDecisionInput,
): CacheDecision {
  if (input.manualRequest) {
    return {
      action: "CACHE",
      reason: "manual_request",
      assetType: "COURSE_CACHE",
    };
  }

  if (input.imagePolicy === "NO_EXTERNAL_IMAGE") {
    return { action: "KEEP_REMOTE", reason: "no_external_image_policy" };
  }

  if (input.imagePolicy === "STORE_COPY") {
    return {
      action: "CACHE",
      reason: "store_copy_policy",
      assetType: "COURSE_CACHE",
    };
  }

  const url = input.sourceUrl ?? "";
  if (!url) {
    return { action: "KEEP_REMOTE", reason: "missing_url" };
  }

  // Short-lived signed URLs / volatile query tokens.
  if (
    /[?&](X-Amz-|Signature=|Expires=|token=|sig=)/i.test(url) ||
    /expires=/i.test(url)
  ) {
    return {
      action: "CACHE",
      reason: "fragile_signed_url",
      assetType: "COURSE_CACHE",
    };
  }

  if ((input.failureCount ?? 0) >= 3) {
    return {
      action: "CACHE",
      reason: "repeated_fetch_failures",
      assetType: "COURSE_CACHE",
    };
  }

  if (
    input.imageStatus === "BROKEN" ||
    input.imageStatus === "BLOCKED"
  ) {
    return { action: "KEEP_REMOTE", reason: "already_broken_or_blocked" };
  }

  // Stable CDNs / official metadata stay remote by default.
  return { action: "KEEP_REMOTE", reason: "stable_remote_default" };
}
