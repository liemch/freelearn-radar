import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        success:
          "border-success/25 bg-success-surface text-success-foreground",
        warning:
          "border-warning/30 bg-warning-surface text-warning-foreground",
        info: "border-info/25 bg-info-surface text-info-foreground",
        danger:
          "border-destructive/25 bg-destructive-surface text-destructive-foreground",
        brand: "border-primary/20 bg-accent text-accent-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.6875rem] leading-4",
        md: "px-2.5 py-1 text-xs leading-4",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
