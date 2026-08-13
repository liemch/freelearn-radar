import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl bg-surface-muted/80 px-4 py-10 text-center sm:px-6 sm:py-12">
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <div className="mt-6">
          <Button asChild className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <LocalizedLink href={actionHref}>{actionLabel}</LocalizedLink>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
