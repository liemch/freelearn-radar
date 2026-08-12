import type { CertificateType, PriceType } from "@/domain/course/types";

export const PRICE_TYPE_LABELS: Record<
  PriceType,
  { label: string; badge: string }
> = {
  FREE_FULL: { label: "100% Free", badge: "🟢" },
  FREE_AUDIT: { label: "Free to Learn", badge: "🔵" },
  FREE_WITH_COUPON: { label: "Coupon Required", badge: "🟠" },
  TEMPORARILY_FREE: { label: "Free Temporarily", badge: "🔥" },
  FREE_TRIAL: { label: "Free Trial", badge: "🟡" },
  PAID: { label: "Paid", badge: "💰" },
  UNKNOWN: { label: "Unknown", badge: "❔" },
};

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  FREE_CERTIFICATE: "Certificate Free",
  PAID_CERTIFICATE: "Certificate Paid",
  NO_CERTIFICATE: "No Certificate",
  UNKNOWN: "Certificate Unknown",
};

export function getPriceTypeLabel(priceType: PriceType) {
  return PRICE_TYPE_LABELS[priceType];
}

export function getCertificateTypeLabel(certificateType: CertificateType) {
  return CERTIFICATE_TYPE_LABELS[certificateType];
}
