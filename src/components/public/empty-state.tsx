import { SearchX } from "lucide-react";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  /**
   * Offered alongside the primary action when a narrowing choice caused the
   * empty result — typically "clear filters", which is the fix the visitor
   * actually needs and cannot otherwise see once the filter panel collapses.
   */
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted/60 px-4 py-10 text-center sm:px-6 sm:py-12">
      <SearchX
        className="mx-auto size-6 text-muted-foreground"
        aria-hidden="true"
      />
      <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {(actionHref && actionLabel) || (secondaryHref && secondaryLabel) ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {secondaryHref && secondaryLabel ? (
            <Button
              asChild
              variant="outline"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            >
              <LocalizedLink href={secondaryHref}>
                {secondaryLabel}
              </LocalizedLink>
            </Button>
          ) : null}
          {actionHref && actionLabel ? (
            <Button asChild className="min-h-11 w-full sm:min-h-9 sm:w-auto">
              <LocalizedLink href={actionHref}>{actionLabel}</LocalizedLink>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
