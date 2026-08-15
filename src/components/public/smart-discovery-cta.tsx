import Link from "next/link";

import { EmptyState } from "@/components/public/empty-state";
import { Button } from "@/components/ui/button";

type SmartDiscoveryCtaProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/**
 * "Không tìm thấy khóa học phù hợp?" — only renders CTAs that navigate for real.
 */
export function SmartDiscoveryCta({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: SmartDiscoveryCtaProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-accent/50 via-card to-surface p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11 rounded-xl px-5">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          {secondaryHref && secondaryLabel ? (
            <Button asChild variant="outline" className="h-11 rounded-xl px-5">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Re-export EmptyState for callers that still want the dashed empty pattern. */
export { EmptyState };
