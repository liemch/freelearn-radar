import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared table shell for admin lists.
 *
 * Every admin table used to be hand-rolled Tailwind, so row height, header
 * treatment, and numeric alignment drifted between pages. These wrappers keep
 * one density and make `caption` non-optional, which the previous tables mostly
 * lacked.
 */
export function AdminTable({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full text-left text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function AdminTh({
  className,
  numeric = false,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border bg-muted/40 px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground",
        numeric && "text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function AdminTd({
  className,
  numeric = false,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-border/60 px-3 py-2 align-middle",
        // Tabular figures keep columns of counts scannable; proportional digits
        // make a column of numbers ragged.
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export function AdminTr({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr className={cn("transition hover:bg-muted/40", className)}>{children}</tr>
  );
}
