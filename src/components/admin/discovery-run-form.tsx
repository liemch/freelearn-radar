"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/admin-panel";
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
  ignoreSchedule: string;
  ignoreScheduleHint: string;
  nothingDue: string;
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
  "h-8 w-full rounded border border-input bg-background px-2 text-[0.8125rem]";
const fieldLabelClass =
  "text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground";

export function DiscoveryRunForm({
  providers,
  categories,
  labels,
}: DiscoveryRunFormProps) {
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(5);
  const [ignoreSchedule, setIgnoreSchedule] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setMessage(null);
    setHint(null);
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
          ignoreSchedule,
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

      const processed = payload.summary?.queriesProcessed ?? 0;
      setMessage(
        formatDiscoverySummary(labels.summary, {
          queriesProcessed: processed,
          created: payload.summary?.created ?? 0,
          duplicates: payload.summary?.duplicates ?? 0,
          invalid: payload.summary?.invalid ?? 0,
          errors: payload.summary?.errors ?? 0,
        }),
      );
      if (processed === 0) {
        setHint(labels.nothingDue);
      }
    } catch {
      setError(labels.runFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPanel title={labels.runDiscovery} description={labels.formDescription}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="discovery-topic" className={fieldLabelClass}>
              {labels.topic}
            </Label>
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

          <div className="space-y-1">
            <Label htmlFor="discovery-provider" className={fieldLabelClass}>
              {labels.provider}
            </Label>
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

          <div className="space-y-1">
            <Label htmlFor="discovery-limit" className={fieldLabelClass}>
              {labels.queryLimit}
            </Label>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <label className="flex items-start gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              className="mt-0.5 size-3.5 rounded border-input"
              checked={ignoreSchedule}
              onChange={(event) => setIgnoreSchedule(event.target.checked)}
            />
            <span className="min-w-0">
              {labels.ignoreSchedule}
              <span className="block text-[0.6875rem] leading-tight text-muted-foreground">
                {labels.ignoreScheduleHint}
              </span>
            </span>
          </label>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={busy}
            aria-busy={busy}
            className="shrink-0"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            {busy ? labels.running : labels.runDiscovery}
          </Button>
        </div>

        {/* Outcome sits inside the panel that produced it, not further down the page. */}
        {message || hint || error ? (
          <div className="space-y-1 rounded border border-border/60 bg-muted/40 px-3 py-2">
            {message ? (
              <p className="text-xs text-foreground" role="status">
                {message}
              </p>
            ) : null}
            {hint ? (
              <p className="text-xs text-warning-foreground">{hint}</p>
            ) : null}
            {error ? (
              <p className="text-xs text-destructive-foreground" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}
