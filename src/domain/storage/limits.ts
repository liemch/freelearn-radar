/**
 * Centralized media size limits (M24).
 * Do not scatter per-route constants for new uploads.
 */

export const MEDIA_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Favicon may also be ICO when stored as branding. */
export const BRANDING_ALLOWED_MIME = new Set([
  ...MEDIA_ALLOWED_MIME,
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export const MEDIA_SIZE_LIMITS = {
  brandingLogo: 512 * 1024,
  brandingLogoCompact: 256 * 1024,
  brandingFavicon: 128 * 1024,
  brandingHero: 2 * 1024 * 1024,
  courseOverride: 1024 * 1024,
  affiliateProduct: 1024 * 1024,
  courseCache: 1024 * 1024,
  remoteFetch: 2 * 1024 * 1024,
} as const;

export type MediaSizeLimitKey = keyof typeof MEDIA_SIZE_LIMITS;
