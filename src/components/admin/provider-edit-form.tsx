"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type ProviderEditFormProps = {
  providerId: string;
  initial: {
    active: boolean;
    affiliateEnabled: boolean;
    affiliateTemplate: string;
  };
  canWrite: boolean;
  labels: {
    active: string;
    affiliateEnabled: string;
    affiliateTemplate: string;
    save: string;
    saving: string;
    saved: string;
    saveFailed: string;
  };
};

export function ProviderEditForm({
  providerId,
  initial,
  canWrite,
  labels,
}: ProviderEditFormProps) {
  const router = useRouter();
  const [active, setActive] = useState(initial.active);
  const [affiliateEnabled, setAffiliateEnabled] = useState(
    initial.affiliateEnabled,
  );
  const [affiliateTemplate, setAffiliateTemplate] = useState(
    initial.affiliateTemplate,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSave() {
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active,
          affiliateEnabled,
          affiliateTemplate: affiliateTemplate.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error || labels.saveFailed);
        return;
      }
      setMessage(labels.saved);
      startTransition(() => router.refresh());
    } catch {
      setError(labels.saveFailed);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          disabled={!canWrite || pending}
          onChange={(e) => setActive(e.target.checked)}
        />
        {labels.active}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={affiliateEnabled}
          disabled={!canWrite || pending}
          onChange={(e) => setAffiliateEnabled(e.target.checked)}
        />
        {labels.affiliateEnabled}
      </label>
      <label className="block space-y-1 text-sm">
        <span>{labels.affiliateTemplate}</span>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={affiliateTemplate}
          disabled={!canWrite || pending}
          onChange={(e) => setAffiliateTemplate(e.target.value)}
        />
      </label>
      {canWrite ? (
        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? labels.saving : labels.save}
        </Button>
      ) : null}
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
