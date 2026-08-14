export type UserRole = "ADMIN" | "EDITOR";

export type CourseStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "EXPIRED"
  | "UNAVAILABLE"
  | "ARCHIVED";

export type PriceType =
  | "FREE_FULL"
  | "FREE_AUDIT"
  | "FREE_PREVIEW"
  | "FREE_WITH_COUPON"
  | "TEMPORARILY_FREE"
  | "FREE_TRIAL"
  | "PAID"
  | "UNKNOWN";

/** M21.4 — coupon offer verification state machine. */
export type CouponOfferStatus =
  | "DISCOVERED"
  | "VERIFYING"
  | "ACTIVE_100_OFF"
  | "ACTIVE_DISCOUNTED"
  | "EXPIRED"
  | "INVALID"
  | "BLOCKED"
  | "UNKNOWN";

export type CourseImageStatus =
  | "OK"
  | "MISSING"
  | "BROKEN"
  | "FALLBACK"
  | "BLOCKED"
  | "PENDING";

export type CourseImageSourceType =
  | "OFFICIAL"
  | "TRUSTED_METADATA"
  | "CACHED"
  | "CATEGORY_FALLBACK"
  | "PROVIDER_FALLBACK"
  | "NONE";

export type CertificateType =
  | "FREE_CERTIFICATE"
  | "PAID_CERTIFICATE"
  | "NO_CERTIFICATE"
  | "UNKNOWN";

export type CourseLevel =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "ALL_LEVELS"
  | "UNKNOWN";

export type DiscoveryStatus =
  | "DISCOVERED"
  | "FETCHED"
  | "ANALYZED"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "INVALID"
  | "DUPLICATE"
  | "EXPIRED"
  | "EXPIRED_UNREVIEWED"
  | "ERROR";

export type FreeDurability =
  | "PERMANENT"
  | "AUDIT_FOREVER"
  | "LIMITED"
  | "UNKNOWN";

export type TrackingTier = "HIGH" | "NORMAL" | "LOW" | "DORMANT";

export type SourceType = "SEARCH" | "MANUAL";

export type VerificationStatus = "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";

export type VerificationMethod =
  | "SEARCH"
  | "PAGE_METADATA"
  | "AI"
  | "MANUAL";
