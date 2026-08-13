"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type DiscoveryRunFormLabels = {
  runDiscovery: string;
  running: string;
  formDescription: string;
  topic: string;
  allTopics: string;
  provider: string;
  allProviders: string;
  queryLimit: string;
  runFailed: string;
  /** Placeholders: {queriesProcessed}, {created}, {duplicates}, {invalid}, {errors} */
  summary: string;
};

function formatDiscoverySummary(
  template: string,
  stats: {
    queriesProcessed: number;
    created: number;
    duplicates: number;
    invalid: number;
    errors: number;
  },
) {
  return template
    .replaceAll("{queriesProcessed}", String(stats.queriesProcessed))
    .replaceAll("{created}", String(stats.created))
    .replaceAll("{duplicates}", String(stats.duplicates))
    .replaceAll("{invalid}", String(stats.invalid))
    .replaceAll("{errors}", String(stats.errors));
}

type DiscoveryRunFormProps = {
  providers: string[];
  categories: string[];
  labels: DiscoveryRunFormLabels;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function DiscoveryRunForm({
  providers,
  categories,
  labels,
}: DiscoveryRunFormProps) {
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit,
          resultLimit: 5,
          provider: provider || undefined,
          category: category || undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        summary?: {
          queriesProcessed: number;
          created: number;
          duplicates: number;
          invalid: number;
          errors: number;
        };
        pendingManualIntegrationTest?: boolean;
      };

      if (!response.ok) {
        setError(payload.error ?? labels.runFailed);
        return;
      }

      setMessage(
        formatDiscoverySummary(labels.summary, {
          queriesProcessed: payload.summary?.queriesProcessed ?? 0,
          created: payload.summary?.created ?? 0,
          duplicates: payload.summary?.duplicates ?? 0,
          invalid: payload.summary?.invalid ?? 0,
          errors: payload.summary?.errors ?? 0,
        }),
      );
    } catch {
      setError(labels.runFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{labels.runDiscovery}</h2>
        <p className="text-sm text-muted-foreground">{labels.formDescription}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="discovery-topic">{labels.topic}</Label>
          <select
            id="discovery-topic"
            className={selectClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{labels.allTopics}</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discovery-provider">{labels.provider}</Label>
          <select
            id="discovery-provider"
            className={selectClass}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="">{labels.allProviders}</option>
            {providers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discovery-limit">{labels.queryLimit}</Label>
          <select
            id="discovery-limit"
            className={selectClass}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {[1, 3, 5, 10, 15].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button onClick={handleRun} disabled={busy}>
        {busy ? labels.running : labels.runDiscovery}
      </Button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
