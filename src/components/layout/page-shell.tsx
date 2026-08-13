import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Wider content for admin tables */
  wide?: boolean;
};

/** Shared public/admin content width + horizontal padding. */
export function PageShell({ children, className, wide }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        wide ? "max-w-6xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-8 py-7 sm:gap-10 sm:py-10 lg:gap-12 lg:py-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
