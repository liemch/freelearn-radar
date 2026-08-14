import { AlertTriangle, Circle, CircleDot, X } from "lucide-react";

import type { HealthState } from "@/domain/admin/operations-snapshot";
import { cn } from "@/lib/utils";

type AdminStatusProps = {
  state: HealthState;
  label: string;
  className?: string;
};

/**
 * Inline status marker for dense rows.
 *
 * Each state differs by glyph shape as well as colour — filled, hollow,
 * triangle, cross — so the distinction survives greyscale and colour-vision
 * deficiency. Lighter than a badge on purpose: a health list is read as a
 * column, and four pills in a row draws more attention than the states deserve
 * when everything is fine.
 */
const STATES: Record<
  HealthState,
  { Icon: typeof Circle; tone: string; fill: boolean }
> = {
  healthy: { Icon: CircleDot, tone: "text-success", fill: true },
  degraded: { Icon: AlertTriangle, tone: "text-warning", fill: false },
  failed: { Icon: X, tone: "text-destructive", fill: false },
  unknown: { Icon: Circle, tone: "text-muted-foreground", fill: false },
};

export function AdminStatus({ state, label, className }: AdminStatusProps) {
  const { Icon, tone } = STATES[state];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
