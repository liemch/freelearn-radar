import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

/** Simple radar arc mark — works at favicon and header sizes. */
export function BrandMark({
  className,
  title = "FreeLearn Radar",
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="16" cy="16" r="15" fill="currentColor" className="text-primary" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="oklch(0.98 0.01 160)" strokeWidth="1.5" opacity="0.55" />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="oklch(0.98 0.01 160)" strokeWidth="1.5" opacity="0.75" />
      <circle cx="16" cy="16" r="2.25" fill="oklch(0.98 0.01 160)" />
      <path
        d="M16 16 L26 8"
        stroke="oklch(0.98 0.01 160)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
