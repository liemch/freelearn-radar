import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "EDITOR"]);

export const courseStatusEnum = pgEnum("course_status", [
  "DRAFT",
  "PUBLISHED",
  "EXPIRED",
  "UNAVAILABLE",
  "ARCHIVED",
]);

export const priceTypeEnum = pgEnum("price_type", [
  "FREE_FULL",
  "FREE_AUDIT",
  "FREE_PREVIEW",
  "FREE_WITH_COUPON",
  "TEMPORARILY_FREE",
  "FREE_TRIAL",
  "PAID",
  "UNKNOWN",
]);

export const certificateTypeEnum = pgEnum("certificate_type", [
  "FREE_CERTIFICATE",
  "PAID_CERTIFICATE",
  "NO_CERTIFICATE",
  "UNKNOWN",
]);

export const courseLevelEnum = pgEnum("course_level", [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "ALL_LEVELS",
  "UNKNOWN",
]);

export const discoveryStatusEnum = pgEnum("discovery_status", [
  "DISCOVERED",
  "FETCHED",
  "ANALYZED",
  "READY_FOR_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "INVALID",
  "DUPLICATE",
  "EXPIRED",
  "EXPIRED_UNREVIEWED",
  "ERROR",
]);

export const sourceTypeEnum = pgEnum("source_type", ["SEARCH", "MANUAL"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "PENDING",
  "VERIFIED",
  "FAILED",
  "EXPIRED",
]);

export const verificationMethodEnum = pgEnum("verification_method", [
  "SEARCH",
  "PAGE_METADATA",
  "AI",
  "MANUAL",
]);

export const freeDurabilityEnum = pgEnum("free_durability", [
  "PERMANENT",
  "AUDIT_FOREVER",
  "LIMITED",
  "UNKNOWN",
]);

export const trackingTierEnum = pgEnum("tracking_tier", [
  "HIGH",
  "NORMAL",
  "LOW",
  "DORMANT",
]);

export const observationFetchStatusEnum = pgEnum("observation_fetch_status", [
  "OK",
  "NOT_FOUND",
  "BLOCKED",
  "TIMEOUT",
  "ERROR",
]);

export const priceEventTypeEnum = pgEnum("price_event_type", [
  "WENT_FREE",
  "WENT_PAID",
  "PRICE_CHANGED",
  "CERT_CHANGED",
  "DELISTED",
  "RETURNED",
]);

export const watchStatusEnum = pgEnum("watch_status", [
  "PENDING",
  "CONFIRMED",
  "NOTIFIED",
  "UNSUBSCRIBED",
]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "USER",
  "WORKER",
  "CRON",
  "AI",
]);

export const extractionMethodEnum = pgEnum("extraction_method", [
  "JSON_LD",
  "OG",
  "HTML_META",
  "PROVIDER_API",
  "SEARCH",
  "AI",
  "MANUAL",
  "POLICY",
]);

export const searchRetrievalModeEnum = pgEnum("search_retrieval_mode", [
  "LEXICAL",
  "SEMANTIC",
  "HYBRID",
]);

export const searchQueryLanguageEnum = pgEnum("search_query_language", [
  "EN",
  "VI",
  "VI_NO_DIACRITIC",
  "UNKNOWN",
]);

export const searchEvalLocaleEnum = pgEnum("search_eval_locale", [
  "EN",
  "VI",
  "VI_NO_DIACRITIC",
]);

export const searchEvalGroupEnum = pgEnum("search_eval_group", [
  "EXACT",
  "KEYWORD",
  "NL",
  "CONSTRAINT",
  "CROSS_LANG",
  "NEGATIVE",
]);

export const embeddingStatusEnum = pgEnum("embedding_status", [
  "PENDING",
  "OK",
  "FAILED",
  "STALE",
]);

export const affiliateProviderTypeEnum = pgEnum("affiliate_provider_type", [
  "COURSE",
  "COMMERCE",
]);

export const commerceProductGroupEnum = pgEnum("commerce_product_group", [
  "BOOK",
  "LAPTOP_TABLET",
  "MONITOR",
  "KEYBOARD_MOUSE",
  "HEADSET_WEBCAM_MIC",
  "LAPTOP_STAND",
  "DESK_LIGHT",
  "STUDY_ACCESSORY",
  "LAB_NETWORKING_DEVICE",
  "OTHER_LEARNING_RELATED",
]);

export const affiliateMerchantEnum = pgEnum("affiliate_merchant", [
  "SHOPEE",
  "LAZADA",
]);

export const affiliateProductStatusEnum = pgEnum("affiliate_product_status", [
  "ACTIVE",
  "INACTIVE",
]);

/** M21.3/M21.4 — coupon offer lifecycle (discovery ≠ Truth). */
export const couponOfferStatusEnum = pgEnum("coupon_offer_status", [
  "DISCOVERED",
  "VERIFYING",
  "ACTIVE_100_OFF",
  "ACTIVE_DISCOUNTED",
  "EXPIRED",
  "INVALID",
  "BLOCKED",
  "UNKNOWN",
]);

export const couponSourceTypeEnum = pgEnum("coupon_source_type", [
  "HTML",
  "RSS",
  "API",
  "MANUAL",
]);

export const couponSourceHealthEnum = pgEnum("coupon_source_health", [
  "HEALTHY",
  "DEGRADED",
  "FAILING",
  "DISABLED",
  "UNKNOWN",
]);

/** M21.6 — course image resolution status. */
export const courseImageStatusEnum = pgEnum("course_image_status", [
  "OK",
  "MISSING",
  "BROKEN",
  "FALLBACK",
  "BLOCKED",
  "PENDING",
]);

export const courseImageSourceTypeEnum = pgEnum("course_image_source_type", [
  "OFFICIAL",
  "TRUSTED_METADATA",
  "CACHED",
  "CATEGORY_FALLBACK",
  "PROVIDER_FALLBACK",
  "ADMIN_OVERRIDE",
  "NONE",
]);
