import { cache } from "react";
import { unstable_cache } from "next/cache";

import { shouldSkipBrandingDb } from "@/domain/branding/build-guard";
import {
  resolveBranding,
  type ResolvedBranding,
} from "@/domain/branding/site-branding";
import { withDb } from "@/lib/db-safe";

export const SITE_BRANDING_CACHE_TAG = "site-branding";

/**
 * Cross-request cache for branding (M25).
 * Branding changes rarely; Admin mutations call revalidateTag via revalidatePublicBranding.
 */
const loadBrandingCached = unstable_cache(
  async (): Promise<ResolvedBranding | null> => {
    return withDb("branding.cached", (db) => resolveBranding(db), null);
  },
  ["site-branding-v1"],
  { revalidate: 60, tags: [SITE_BRANDING_CACHE_TAG] },
);

/**
 * Request-scoped dedupe: root metadata + page + SiteHeader share one resolve.
 */
export const getResolvedBranding = cache(
  async (): Promise<ResolvedBranding | null> => {
    if (shouldSkipBrandingDb()) return null;
    return loadBrandingCached();
  },
);
