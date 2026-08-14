import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  /** Page-level controls, right-aligned on wide screens. */
  actions?: ReactNode;
  /** Compact status/context shown under the title, e.g. counts or health. */
  meta?: ReactNode;
};

/**
 * Compact page header. Sits directly on the workspace rather than inside a
 * panel — wrapping the title in another bordered card was one of the things
 * that made every admin page read as a stack of identical boxes.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  meta,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
