import type {
  CertificateType,
  CourseStatus,
  DiscoveryStatus,
  PriceType,
} from "@/domain/course/types";
import type { Locale } from "@/lib/i18n/config";

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
  FREE_PREVIEW: {
    label: "Free Preview",
    shortHint: "Preview only — not full free access",
  },
  FREE_WITH_COUPON: {
    label: "Coupon 100%",
    shortHint: "Verified 100% off coupon required",
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

const PRICE_TYPE_LABELS_VI: Record<
  PriceType,
  { label: string; shortHint: string }
> = {
  FREE_FULL: {
    label: "Miễn phí lâu dài",
    shortHint: "Truy cập toàn bộ khóa học không mất phí",
  },
  FREE_AUDIT: {
    label: "Học miễn phí (audit)",
    shortHint: "Học toàn bộ nội dung miễn phí; chứng chỉ thường phải trả phí",
  },
  FREE_PREVIEW: {
    label: "Xem trước miễn phí",
    shortHint: "Chỉ xem trước — không phải học toàn bộ miễn phí",
  },
  FREE_WITH_COUPON: {
    label: "Coupon 100%",
    shortHint: "Cần mã giảm 100% đã được xác minh",
  },
  TEMPORARILY_FREE: {
    label: "Miễn phí có thời hạn",
    shortHint: "Khuyến mãi có thể kết thúc sớm",
  },
  FREE_TRIAL: {
    label: "Dùng thử miễn phí",
    shortHint: "Truy cập thử trong thời gian giới hạn",
  },
  PAID: {
    label: "Trả phí",
    shortHint: "Không phải ưu đãi miễn phí",
  },
  UNKNOWN: {
    label: "Chưa rõ trạng thái",
    shortHint: "Xác nhận trên trang nền tảng",
  },
};

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  FREE_CERTIFICATE: "Free certificate",
  PAID_CERTIFICATE: "Paid certificate",
  NO_CERTIFICATE: "No certificate",
  UNKNOWN: "Certificate unknown",
};

const CERTIFICATE_TYPE_LABELS_VI: Record<CertificateType, string> = {
  FREE_CERTIFICATE: "Chứng chỉ miễn phí",
  PAID_CERTIFICATE: "Chứng chỉ trả phí",
  NO_CERTIFICATE: "Không có chứng chỉ",
  UNKNOWN: "Chưa rõ chứng chỉ",
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
  EXPIRED_UNREVIEWED: "Expired unreviewed",
  ERROR: "Error",
};

export function getPriceTypeLabel(priceType: PriceType, locale: Locale = "en") {
  const table = locale === "vi" ? PRICE_TYPE_LABELS_VI : PRICE_TYPE_LABELS;
  return table[priceType];
}

export function getCertificateTypeLabel(
  certificateType: CertificateType,
  locale: Locale = "en",
) {
  const table =
    locale === "vi" ? CERTIFICATE_TYPE_LABELS_VI : CERTIFICATE_TYPE_LABELS;
  return table[certificateType];
}

export function getCourseStatusLabel(status: CourseStatus) {
  return COURSE_STATUS_LABELS[status] ?? status;
}

export function getDiscoveryStatusLabel(status: DiscoveryStatus) {
  return DISCOVERY_STATUS_LABELS[status] ?? status;
}

export function formatLevelLabel(level: string, locale: Locale = "en"): string {
  if (!level || level === "UNKNOWN") {
    return locale === "vi" ? "Trình độ chưa rõ" : "Level unknown";
  }
  return level
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
