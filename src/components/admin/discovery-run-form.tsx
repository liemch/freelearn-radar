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
  resultLimit: string;
  runFailed: string;
  ignoreSchedule: string;
  ignoreScheduleHint: string;
  nothingDue: string;
  /** Placeholders: {queriesProcessed}, {created}, {duplicates}, {invalid}, {errors} */
  summary: string;
  /** Placeholders: {fetched}, {analyzed} */
  pipelineSummary: string;
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
  /** Prefill from coverage recommendation / URL (M27). */
  initialCategory?: string;
  initialProvider?: string;
};

const selectClass =
  "h-8 w-full rounded border border-input bg-background px-2 text-[0.8125rem]";
const fieldLabelClass =
  "text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground";

export function DiscoveryRunForm({
  providers,
  categories,
  labels,
  initialCategory = "",
  initialProvider = "",
}: DiscoveryRunFormProps) {
  const [provider, setProvider] = useState(initialProvider);
  const [category, setCategory] = useState(initialCategory);
  const [limit, setLimit] = useState(25);
  const [resultLimit, setResultLimit] = useState(10);
  const [ignoreSchedule, setIgnoreSchedule] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

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
          resultLimit,
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
          sourceFetched?: number;
          analyzed?: number;
        };
        pendingManualIntegrationTest?: boolean;
      };

      if (!response.ok) {
        setError(payload.error ?? labels.runFailed);
        return;
      }

      const processed = payload.summary?.queriesProcessed ?? 0;
      const base = formatDiscoverySummary(labels.summary, {
        queriesProcessed: processed,
        created: payload.summary?.created ?? 0,
        duplicates: payload.summary?.duplicates ?? 0,
        invalid: payload.summary?.invalid ?? 0,
        errors: payload.summary?.errors ?? 0,
      });
      const pipeline = labels.pipelineSummary
        .replaceAll("{fetched}", String(payload.summary?.sourceFetched ?? 0))
        .replaceAll("{analyzed}", String(payload.summary?.analyzed ?? 0));
      setMessage(`${base} ${pipeline}`);
      if (processed === 0) {
        setHint(labels.nothingDue);
      }
    } catch {
      setError(labels.runFailed);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const confirmSummary = [
    category ? `topic=${category}` : "topic=ALL",
    provider ? `provider=${provider}` : "provider=ALL",
    `queries≤${limit}`,
    `results/query≤${resultLimit}`,
    `maxCandidates≤${limit * resultLimit}`,
  ].join(" · ");

  return (
    <AdminPanel title={labels.runDiscovery} description={labels.formDescription}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="discovery-topic" className={fieldLabelClass}>
              {labels.topic}
            </Label>
            <select
              id="discovery-topic"
              className={selectClass}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setConfirming(false);
              }}
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
              onChange={(event) => {
                setProvider(event.target.value);
                setConfirming(false);
              }}
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
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setConfirming(false);
              }}
            >
              {[5, 10, 15, 25, 50].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="discovery-result-limit" className={fieldLabelClass}>
              {labels.resultLimit}
            </Label>
            <select
              id="discovery-result-limit"
              className={selectClass}
              value={resultLimit}
              onChange={(event) => {
                setResultLimit(Number(event.target.value));
                setConfirming(false);
              }}
            >
              {[3, 5, 8, 10].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        {confirming ? (
          <div
            className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground"
            role="status"
          >
            Xác nhận phạm vi trước khi chạy: {confirmSummary}. Không auto-publish.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <label className="flex items-start gap-2 text-[0.8125rem]">
            <input
              type="checkbox"
              className="mt-0.5 size-3.5 rounded border-input"
              checked={ignoreSchedule}
              onChange={(event) => {
                setIgnoreSchedule(event.target.checked);
                setConfirming(false);
              }}
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
            {busy
              ? labels.running
              : confirming
                ? "Xác nhận chạy"
                : labels.runDiscovery}
          </Button>
        </div>

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
