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
