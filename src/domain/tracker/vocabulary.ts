import type { FreeDurability } from "@/domain/course/types";
import type { Locale } from "@/lib/i18n/config";

export type PriceEventLabelKey =
  | "WENT_FREE"
  | "WENT_PAID"
  | "PRICE_CHANGED"
  | "CERT_CHANGED"
  | "DELISTED"
  | "RETURNED";

const FREE_DURABILITY: Record<
  FreeDurability,
  { en: string; vi: string }
> = {
  PERMANENT: { en: "Usually free", vi: "Thường miễn phí" },
  AUDIT_FOREVER: { en: "Audit forever", vi: "Học thử lâu dài" },
  LIMITED: { en: "Limited-time free", vi: "Miễn phí có thời hạn" },
  UNKNOWN: { en: "Free status unclear", vi: "Chưa rõ độ bền miễn phí" },
};

const FRESHNESS = {
  fresh: { en: "Checked recently", vi: "Vừa kiểm tra" },
  today: { en: "Checked today", vi: "Kiểm tra hôm nay" },
  stale: { en: "May be outdated", vi: "Có thể đã cũ" },
  never: { en: "Not checked yet", vi: "Chưa kiểm tra" },
} as const;

const EVENT_LABELS: Record<PriceEventLabelKey, { en: string; vi: string }> = {
  WENT_FREE: { en: "Just went free", vi: "Vừa miễn phí" },
  WENT_PAID: { en: "Back to paid", vi: "Quay lại tính phí" },
  PRICE_CHANGED: { en: "Price changed", vi: "Giá thay đổi" },
  CERT_CHANGED: { en: "Certificate changed", vi: "Chứng chỉ thay đổi" },
  DELISTED: { en: "Delisted", vi: "Đã gỡ" },
  RETURNED: { en: "Listed again", vi: "Xuất hiện lại" },
};

export function freeDurabilityLabel(
  value: FreeDurability,
  locale: Locale = "en",
): string {
  const entry = FREE_DURABILITY[value] ?? FREE_DURABILITY.UNKNOWN;
  return locale === "vi" ? entry.vi : entry.en;
}

export function lastVerifiedFreshnessLabel(
  lastVerifiedAt: Date | string | null | undefined,
  locale: Locale = "en",
  now = new Date(),
): string {
  if (!lastVerifiedAt) {
    return locale === "vi" ? FRESHNESS.never.vi : FRESHNESS.never.en;
  }

  const verified =
    typeof lastVerifiedAt === "string"
      ? new Date(lastVerifiedAt)
      : lastVerifiedAt;
  if (Number.isNaN(verified.getTime())) {
    return locale === "vi" ? FRESHNESS.never.vi : FRESHNESS.never.en;
  }

  const ageMs = now.getTime() - verified.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 24) {
    return locale === "vi" ? FRESHNESS.today.vi : FRESHNESS.today.en;
  }
  if (ageHours < 24 * 7) {
    return locale === "vi" ? FRESHNESS.fresh.vi : FRESHNESS.fresh.en;
  }
  return locale === "vi" ? FRESHNESS.stale.vi : FRESHNESS.stale.en;
}

export function priceEventLabel(
  eventType: PriceEventLabelKey | string,
  locale: Locale = "en",
): string {
  const entry = EVENT_LABELS[eventType as PriceEventLabelKey];
  if (!entry) return eventType;
  return locale === "vi" ? entry.vi : entry.en;
}

/** Max badges on a course card / detail chip row. */
export const MAX_COURSE_BADGES = 3;

/**
 * Build up to 3 badge keys: price (always), certificate (if known), durability (if known).
 */
export function selectCourseBadgeSlots(input: {
  certificateKnown: boolean;
  freeDurability: FreeDurability;
}): Array<"price" | "certificate" | "durability"> {
  const slots: Array<"price" | "certificate" | "durability"> = ["price"];
  if (input.certificateKnown && slots.length < MAX_COURSE_BADGES) {
    slots.push("certificate");
  }
  if (
    input.freeDurability !== "UNKNOWN" &&
    slots.length < MAX_COURSE_BADGES
  ) {
    slots.push("durability");
  }
  return slots.slice(0, MAX_COURSE_BADGES);
}
