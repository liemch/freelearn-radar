"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ShareCourseButtonProps = {
  title: string;
  url: string;
};

export function ShareCourseButton({ title, url }: ShareCourseButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url, text: title });
        return;
      }
    } catch {
      // User cancelled or share failed — fall through to copy.
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={onShare}>
      {copied ? "Link copied" : "Share / Copy link"}
    </Button>
  );
}
