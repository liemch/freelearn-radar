import Link from "next/link";

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
    <section
      role="status"
      className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
    >
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <p className="mt-5">
          <Link
            href={actionHref}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {actionLabel}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
