import {
  daysSince,
  isStaleForPublicWarning,
  verificationAgeLabel,
} from "@/domain/verification/freshness-policy";
import type { PriceType } from "@/domain/course/types";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type VerificationFreshnessProps = {
  lastVerifiedAt: Date | null | undefined;
  priceType: PriceType;
  locale?: Locale;
  now?: Date;
};

export function VerificationFreshnessNotice({
  lastVerifiedAt,
  priceType,
  locale = defaultLocale,
  now = new Date(),
}: VerificationFreshnessProps) {
  const dict = getDictionary(locale);
  const label = verificationAgeLabel(lastVerifiedAt, now, dict.verification);
  const stale = isStaleForPublicWarning(lastVerifiedAt, priceType, now);
  const days = lastVerifiedAt ? Math.floor(daysSince(lastVerifiedAt, now)) : null;

  if (!lastVerifiedAt) {
    return (
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        {dict.verification.notVerifiedNotice}
      </p>
    );
  }

  if (stale) {
    return (
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        {dict.verification.staleNotice(days ?? 0)}
      </p>
    );
  }

  if (days !== null && days <= 7) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {dict.verification.recently} · {label}
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {label}
    </p>
  );
}
