import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { LocalizedLink } from "@/components/public/localized-link";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  /** Omit on the final crumb — the current page is not a link. */
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  label: string;
  className?: string;
};

/**
 * Replaces the four slightly different inline breadcrumb patterns that had
 * grown across the catalog pages. Marks the last crumb with aria-current rather
 * than linking it to the page you are already on.
 */
export function Breadcrumb({ items, label, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="min-w-0">
                {item.href && !isLast ? (
                  <LocalizedLink
                    href={item.href}
                    className="rounded transition hover:text-foreground"
                  >
                    {item.label}
                  </LocalizedLink>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn("block truncate", isLast && "text-foreground")}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {isLast ? null : (
                <li aria-hidden="true" className="text-border">
                  <ChevronRight className="size-3" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
