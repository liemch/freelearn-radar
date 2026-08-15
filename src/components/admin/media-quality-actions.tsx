"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type MediaQualityActionsProps = {
  courseId: string;
  hasOverride: boolean;
};

export function MediaQualityActions({
  courseId,
  hasOverride,
}: MediaQualityActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(body: Record<string, unknown> | FormData) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/image`, {
        method: "PATCH",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Thất bại");
        return;
      }
      router.refresh();
    } catch {
      setError("Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button asChild size="sm" variant="outline" disabled={busy}>
        <a href={`/admin/courses/${courseId}`}>Xem</a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void call({ action: "resolve" })}
      >
        Resolve lại
      </Button>
      {hasOverride ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void call({ action: "clear" })}
        >
          Xóa override
        </Button>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
