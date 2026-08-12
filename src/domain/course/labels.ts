import type {
  CertificateType,
  CourseStatus,
  DiscoveryStatus,
  PriceType,
} from "@/domain/course/types";

export const PRICE_TYPE_LABELS: Record<
  PriceType,
  { label: string; shortHint: string }
> = {
  FREE_FULL: {
    label: "100% Free",
    shortHint: "Full course access at no cost",
  },
  FREE_AUDIT: {
    label: "Free to Audit",
    shortHint: "Learn free; extras may be paid",
  },
  FREE_WITH_COUPON: {
    label: "Coupon Required",
    shortHint: "Needs a valid promo code",
  },
  TEMPORARILY_FREE: {
    label: "Limited-Time Free",
    shortHint: "Promotion may end soon",
  },
  FREE_TRIAL: {
    label: "Free Trial",
    shortHint: "Time-limited trial access",
  },
  PAID: {
    label: "Paid",
    shortHint: "Not a free offer",
  },
  UNKNOWN: {
    label: "Status Unknown",
    shortHint: "Confirm free status on the provider site",
  },
};

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  FREE_CERTIFICATE: "Free certificate",
  PAID_CERTIFICATE: "Paid certificate",
  NO_CERTIFICATE: "No certificate",
  UNKNOWN: "Certificate unknown",
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  EXPIRED: "Expired offer",
  UNAVAILABLE: "Unavailable",
  ARCHIVED: "Archived",
};

export const DISCOVERY_STATUS_LABELS: Record<DiscoveryStatus, string> = {
  DISCOVERED: "Discovered",
  FETCHED: "Fetched",
  ANALYZED: "Needs extra review",
  READY_FOR_REVIEW: "Ready for review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  INVALID: "Invalid",
  DUPLICATE: "Duplicate",
  EXPIRED: "Expired",
  ERROR: "Error",
};

export function getPriceTypeLabel(priceType: PriceType) {
  return PRICE_TYPE_LABELS[priceType];
}

export function getCertificateTypeLabel(certificateType: CertificateType) {
  return CERTIFICATE_TYPE_LABELS[certificateType];
}

export function getCourseStatusLabel(status: CourseStatus) {
  return COURSE_STATUS_LABELS[status] ?? status;
}

export function getDiscoveryStatusLabel(status: DiscoveryStatus) {
  return DISCOVERY_STATUS_LABELS[status] ?? status;
}

export function formatLevelLabel(level: string): string {
  if (!level || level === "UNKNOWN") return "Level unknown";
  return level
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
