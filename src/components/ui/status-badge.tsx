import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  Clock,
  XCircle,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";

export type StatusTone =
  | "healthy"
  | "warning"
  | "error"
  | "unknown"
  | "pending"
  | "success"
  | "idle";

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  size?: BadgeProps["size"];
  className?: string;
};

/**
 * Status is carried by three redundant signals — icon shape, text label, and
 * colour — so it survives greyscale printing, colour-vision deficiency, and the
 * glance-scanning that operators actually do.
 */
const TONES: Record<
  StatusTone,
  { variant: NonNullable<BadgeProps["variant"]>; Icon: typeof CheckCircle2 }
> = {
  healthy: { variant: "success", Icon: CheckCircle2 },
  success: { variant: "success", Icon: CheckCircle2 },
  warning: { variant: "warning", Icon: AlertTriangle },
  error: { variant: "danger", Icon: XCircle },
  pending: { variant: "info", Icon: Clock },
  unknown: { variant: "outline", Icon: CircleHelp },
  idle: { variant: "neutral", Icon: CircleDashed },
};

export function StatusBadge({
  tone,
  label,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const { variant, Icon } = TONES[tone];

  return (
    <Badge variant={variant} size={size} className={className}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
