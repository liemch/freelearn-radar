"use client";

import { useState } from "react";

type CandidateSourceImageProps = {
  src: string;
  alt: string;
};

/** Hide a provider image cleanly when hotlinking is blocked or it expires. */
export function CandidateSourceImage({
  src,
  alt,
}: CandidateSourceImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary provider domains; failure is handled
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="mt-3 aspect-video w-full max-w-xl rounded-lg border border-border object-cover"
    />
  );
}
