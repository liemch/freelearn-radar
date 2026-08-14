"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DiscoveryQueryToggleProps = {
  queryId: string;
  enabled: boolean;
  labels: {
    enabled: string;
    toggleFailed: string;
  };
};

export function DiscoveryQueryToggle({
  queryId,
  enabled,
  labels,
}: DiscoveryQueryToggleProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onToggle(next: boolean) {
    setError(null);
    const previous = checked;
    setChecked(next);
    try {
      const response = await fetch(`/api/admin/discovery/queries/${queryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!response.ok) {
        setChecked(previous);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error || labels.toggleFailed);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setChecked(previous);
      setError(labels.toggleFailed);
    }
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {labels.enabled}
      </label>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
