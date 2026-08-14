"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AiDiagnosePanelLabels = {
  heading: string;
  description: string;
  run: string;
  running: string;
  /** Placeholders: {model}, {latency} */
  success: string;
  /** Placeholders: {model}, {latency} */
  failure: string;
  requestFailed: string;
};

type DiagnoseResult = {
  ok: boolean;
  model: string;
  latencyMs?: number;
  error?: string;
  sample?: {
    title: string;
    price_type: string;
    certificate_type: string;
    confidence: number;
  };
};

function format(template: string, model: string, latencyMs: number) {
  return template
    .replaceAll("{model}", model)
    .replaceAll("{latency}", (latencyMs / 1000).toFixed(1));
}

export function AiDiagnosePanel({ labels }: { labels: AiDiagnosePanelLabels }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai/diagnose", {
        method: "POST",
      });
      if (!response.ok) {
        setError(labels.requestFailed);
        return;
      }
      setResult((await response.json()) as DiagnoseResult);
    } catch {
      setError(labels.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{labels.heading}</h2>
        <p className="text-sm text-muted-foreground">{labels.description}</p>
      </div>

      <Button
        variant="secondary"
        onClick={handleRun}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {busy ? labels.running : labels.run}
      </Button>

      {result?.ok ? (
        <div className="space-y-2" role="status">
          <p className="text-sm text-emerald-700">
            {format(labels.success, result.model, result.latencyMs ?? 0)}
          </p>
          {result.sample ? (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              {JSON.stringify(result.sample, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {result && !result.ok ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-destructive">
            {format(labels.failure, result.model, result.latencyMs ?? 0)}
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
            {result.error}
          </pre>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
