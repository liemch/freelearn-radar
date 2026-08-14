import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminPanelProps = {
  title?: string;
  description?: string;
  /** Right-aligned controls in the panel header. */
  actions?: ReactNode;
  /** Drop body padding when the panel holds a table or a divided list. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Level 2 of the admin hierarchy: an operational panel.
 *
 * Deliberately quieter than the public card — hairline border, small radius,
 * tight padding — because an operations page shows many of them at once and
 * uniform heavy cards flatten the hierarchy into visual noise. Grouping is
 * carried by the header rule and spacing, not by weight.
 */
export function AdminPanel({
  title,
  description,
  actions,
  flush = false,
  className,
  children,
}: AdminPanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="min-w-0">
            <h2 className="text-[0.8125rem] font-semibold leading-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "p-3.5"}>{children}</div>
    </section>
  );
}
