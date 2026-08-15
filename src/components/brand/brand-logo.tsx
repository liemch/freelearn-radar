import Image from "next/image";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  /** Full logo from Admin branding, or null for SVG fallback. */
  logoUrl?: string | null;
  /** Compact/icon logo preferred in tight slots. */
  compactUrl?: string | null;
  title?: string;
  className?: string;
  /** Prefer compact asset when both exist. */
  compact?: boolean;
  /** Height class for the image slot (width auto). */
  imageClassName?: string;
};

/**
 * Resolves Admin-managed logo → bundled BrandMark.
 * Layout stays stable across aspect ratios via object-contain + fixed height.
 */
export function BrandLogo({
  logoUrl,
  compactUrl,
  title = "FreeLearn Radar",
  className,
  compact = false,
  imageClassName,
}: BrandLogoProps) {
  const src = compact ? compactUrl || logoUrl : logoUrl || compactUrl;

  if (src) {
    return (
      <span
        className={cn(
          "relative inline-flex h-8 w-auto max-w-[11rem] items-center sm:h-9",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- branding URLs are same-origin API routes */}
        <img
          src={src}
          alt={title}
          className={cn(
            "h-full w-auto max-w-full object-contain object-left",
            imageClassName,
          )}
        />
      </span>
    );
  }

  return <BrandMark className={cn("size-7 text-primary", className)} title={title} />;
}

/** Optional Next/Image variant when dimensions are known. Unused for API assets. */
export function BrandLogoImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="h-8 w-auto object-contain"
      unoptimized
    />
  );
}
