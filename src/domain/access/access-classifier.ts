/**
 * M21.5 — Course access classification (access ≠ certificate).
 * Reuses priceTypeEnum; adds FREE_PREVIEW; does not conflate free types.
 */

import type { CertificateType, PriceType } from "@/domain/course/types";

export type AccessClassification = {
  access: PriceType;
  certificate: CertificateType;
};

const ACCESS_LABELS_VI: Record<PriceType, string> = {
  FREE_FULL: "Học toàn bộ miễn phí",
  FREE_AUDIT: "Có thể học miễn phí; một số bài đánh giá/chứng chỉ có thể trả phí",
  FREE_PREVIEW: "Xem trước miễn phí",
  FREE_WITH_COUPON: "Coupon 100%",
  TEMPORARILY_FREE: "Miễn phí có thời hạn",
  FREE_TRIAL: "Dùng thử miễn phí",
  PAID: "Trả phí",
  UNKNOWN: "Chưa rõ trạng thái truy cập",
};

const CERT_LABELS_VI: Record<CertificateType, string> = {
  FREE_CERTIFICATE: "Chứng chỉ miễn phí",
  PAID_CERTIFICATE: "Chứng chỉ trả phí",
  NO_CERTIFICATE: "Không có chứng chỉ",
  UNKNOWN: "Chưa rõ chứng chỉ",
};

/** Public badge short labels — FREE_PREVIEW must never read as 100% free. */
const BADGE_LABELS_VI: Record<PriceType, string> = {
  FREE_FULL: "Miễn phí lâu dài",
  FREE_AUDIT: "Học miễn phí (audit)",
  FREE_PREVIEW: "Xem trước miễn phí",
  FREE_WITH_COUPON: "Coupon 100%",
  TEMPORARILY_FREE: "Miễn phí hôm nay",
  FREE_TRIAL: "Dùng thử miễn phí",
  PAID: "Trả phí",
  UNKNOWN: "Chưa rõ",
};

export function getAccessLabelVi(access: PriceType): string {
  return ACCESS_LABELS_VI[access];
}

export function getAccessBadgeLabelVi(access: PriceType): string {
  return BADGE_LABELS_VI[access];
}

export function getCertificateLabelVi(certificate: CertificateType): string {
  return CERT_LABELS_VI[certificate];
}

/** Eligible for "Miễn phí hôm nay" / durable free surfaces. */
export function isDailyFreeEligibleAccess(access: PriceType): boolean {
  return access === "FREE_WITH_COUPON" || access === "TEMPORARILY_FREE";
}

export function isDurableFreeAccess(access: PriceType): boolean {
  return access === "FREE_FULL" || access === "FREE_AUDIT";
}

/** Must NOT appear as free deal. */
export function isPreviewOrTrialOnly(access: PriceType): boolean {
  return access === "FREE_PREVIEW" || access === "FREE_TRIAL";
}

/**
 * Heuristic classifier from provider page text (Coursera-oriented).
 * Deterministic; does not invent FREE_FULL from weak signals.
 */
export function classifyAccessFromText(params: {
  providerSlug: string;
  text: string;
  existing?: PriceType | null;
}): AccessClassification {
  const text = params.text.toLowerCase();
  const provider = params.providerSlug.toLowerCase();

  let certificate: CertificateType = "UNKNOWN";
  if (
    /certificate.*(paid|purchase|buy)|paid certificate|chứng chỉ.*trả phí/.test(
      text,
    )
  ) {
    certificate = "PAID_CERTIFICATE";
  } else if (
    /free certificate|certificate included|chứng chỉ miễn phí/.test(text)
  ) {
    certificate = "FREE_CERTIFICATE";
  } else if (/no certificate|without certificate/.test(text)) {
    certificate = "NO_CERTIFICATE";
  }

  if (provider.includes("coursera")) {
    if (
      /audit for free|enroll for free|học miễn phí.*audit|free to audit/.test(
        text,
      )
    ) {
      return { access: "FREE_AUDIT", certificate: certificate === "UNKNOWN" ? "PAID_CERTIFICATE" : certificate };
    }
    if (/free trial|dùng thử/.test(text) && !/audit/.test(text)) {
      return { access: "FREE_TRIAL", certificate };
    }
    if (/preview|xem trước|sample lesson/.test(text) && !/audit/.test(text)) {
      return { access: "FREE_PREVIEW", certificate };
    }
    if (/full course.*(free|miễn phí)|100%\s*free/.test(text)) {
      return { access: "FREE_FULL", certificate };
    }
  }

  if (/coupon|couponcode|100%\s*off/.test(text)) {
    return { access: "FREE_WITH_COUPON", certificate };
  }
  if (/limited.?time|temporarily free|miễn phí có thời hạn/.test(text)) {
    return { access: "TEMPORARILY_FREE", certificate };
  }
  if (/free trial|dùng thử/.test(text)) {
    return { access: "FREE_TRIAL", certificate };
  }
  if (/preview only|free preview|xem trước miễn phí/.test(text)) {
    return { access: "FREE_PREVIEW", certificate };
  }
  if (/audit/.test(text)) {
    return { access: "FREE_AUDIT", certificate };
  }
  if (/free|miễn phí/.test(text) && !/trial|preview|coupon/.test(text)) {
    return { access: "FREE_FULL", certificate };
  }
  if (/\$|paid|trả phí|buy now/.test(text)) {
    return { access: "PAID", certificate };
  }

  return {
    access: params.existing ?? "UNKNOWN",
    certificate,
  };
}
