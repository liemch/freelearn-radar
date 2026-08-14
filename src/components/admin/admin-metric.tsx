import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type AdminMetricTone = "default" | "attention" | "critical" | "positive";

type AdminMetricProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: AdminMetricTone;
};

const TONE_VALUE: Record<AdminMetricTone, string> = {
  default: "text-foreground",
  positive: "text-success-foreground",
  attention: "text-warning-foreground",
  critical: "text-destructive-foreground",
};

/**
 * Level 3: a single figure with its label. Compact by design — these appear in
 * rows of four or five, and a dashboard where every number is a large card is
 * a dashboard where no number stands out.
 *
 * `tone` is reserved for values that mean something is wrong; a zero error
 * count stays neutral rather than celebrating itself in green.
 */
export function AdminMetric({
  label,
  value,
  hint,
  href,
  tone = "default",
}: AdminMetricProps) {
  const body = (
    <>
      <span
        className={cn(
          "block text-2xl font-semibold leading-none tabular-nums",
          TONE_VALUE[tone],
        )}
      >
        {value}
      </span>
      <span className="mt-1.5 block text-xs font-medium leading-tight text-muted-foreground">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block truncate text-[0.6875rem] leading-tight text-muted-foreground/80">
          {hint}
        </span>
      ) : null}
    </>
  );

  const shared = "block rounded-md border border-border bg-card px-3.5 py-3";

  return href ? (
    <Link href={href} className={cn(shared, "transition hover:border-primary/40")}>
      {body}
    </Link>
  ) : (
    <div className={shared}>{body}</div>
  );
}

/** Responsive row for a set of metrics; collapses to two columns on mobile. */
export function AdminMetricRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      // Two across until there is genuine room for four: at tablet width a
      // four-column row squeezes labels into two lines each.
      className={cn("grid grid-cols-2 gap-2.5 lg:grid-cols-4", className)}
    >
      {children}
    </div>
  );
}
