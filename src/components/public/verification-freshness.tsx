import {
  isStaleForPublicWarning,
  verificationAgeLabel,
} from "@/domain/verification/freshness-policy";
import type { PriceType } from "@/domain/course/types";
import { daysSince } from "@/domain/verification/freshness-policy";

type VerificationFreshnessProps = {
  lastVerifiedAt: Date | null | undefined;
  priceType: PriceType;
  now?: Date;
};

export function VerificationFreshnessNotice({
  lastVerifiedAt,
  priceType,
  now = new Date(),
}: VerificationFreshnessProps) {
  const label = verificationAgeLabel(lastVerifiedAt, now);
  const stale = isStaleForPublicWarning(lastVerifiedAt, priceType, now);
  const days = lastVerifiedAt ? Math.floor(daysSince(lastVerifiedAt, now)) : null;

  if (!lastVerifiedAt) {
    return (
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        Free status has not been verified yet. Details may be incomplete.
      </p>
    );
  }

  if (stale) {
    return (
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        role="status"
      >
        Free status last verified {days} day{days === 1 ? "" : "s"} ago. The offer
        may have changed — confirm on the provider site before enrolling.
      </p>
    );
  }

  if (days !== null && days <= 7) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Verified recently · {label}
      </p>
    );
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      {label}
    </p>
  );
}
