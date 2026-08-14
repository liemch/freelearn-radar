"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type CourseCardVisualProps = {
  src: string | null;
  eyebrow: string;
  title: string;
  toneClass: string;
  /** Above-the-fold cards skip lazy loading so the first screen paints complete. */
  priority?: boolean;
  className?: string;
};

/**
 * The 16:9 slot on a course card.
 *
 * Client-side because a remote provider image can 404, expire, or block
 * hotlinking at any time, and a broken-image icon on a curated catalogue looks
 * like the product is broken. On error the tile takes over silently.
 */
export function CourseCardVisual({
  src,
  eyebrow,
  title,
  toneClass,
  priority = false,
  className,
}: CourseCardVisualProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        "relative aspect-16/9 w-full overflow-hidden bg-surface-muted",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary provider domains; next/image would need an open remotePatterns allowlist
        <img
          src={src as string}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className="size-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div
          className={cn(
            "course-tile flex size-full flex-col justify-end gap-1 p-4 text-white",
            toneClass,
          )}
        >
          {eyebrow ? (
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-white/70">
              {eyebrow}
            </span>
          ) : null}
          <span className="line-clamp-2 font-display text-base leading-snug text-balance sm:text-lg">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
