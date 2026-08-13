import type { PriceType } from "@/domain/course/types";
import { getPriceTypeLabel } from "@/domain/course/labels";
import { cn } from "@/lib/utils";

const TONE: Record<PriceType, string> = {
  FREE_FULL: "bg-emerald-100 text-emerald-950 border-emerald-200",
  FREE_AUDIT: "bg-sky-100 text-sky-950 border-sky-200",
  FREE_WITH_COUPON: "bg-amber-100 text-amber-950 border-amber-200",
  TEMPORARILY_FREE: "bg-orange-100 text-orange-950 border-orange-200",
  FREE_TRIAL: "bg-yellow-100 text-yellow-950 border-yellow-200",
  PAID: "bg-secondary text-secondary-foreground border-border",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

type FreeStatusBadgeProps = {
  priceType: PriceType;
  locale?: import("@/lib/i18n/config").Locale;
  size?: "sm" | "md" | "lg";
  className?: string;
  showHint?: boolean;
};

export function freeStatusTone(priceType: PriceType): string {
  return TONE[priceType] ?? TONE.UNKNOWN;
}

export function FreeStatusBadge({
  priceType,
  locale = "en",
  size = "md",
  className,
  showHint = false,
}: FreeStatusBadgeProps) {
  const { label, shortHint } = getPriceTypeLabel(priceType, locale);
  const sizeClass =
    size === "lg"
      ? "px-4 py-1.5 text-base"
      : size === "sm"
        ? "px-2.5 py-0.5 text-xs"
        : "px-3 py-1 text-sm";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-start border font-semibold",
        showHint ? "flex-col rounded-xl" : "flex-col rounded-full",
        sizeClass,
        freeStatusTone(priceType),
        className,
      )}
      title={shortHint}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
        />
        {label}
      </span>
      {showHint ? (
        <span className="mt-0.5 text-[11px] font-normal opacity-80">
          {shortHint}
        </span>
      ) : null}
    </span>
  );
}
