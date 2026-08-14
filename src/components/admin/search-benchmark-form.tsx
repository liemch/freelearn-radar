"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/admin-panel";
import { Button } from "@/components/ui/button";

type SearchBenchmarkFormLabels = {
  title: string;
  description: string;
  run: string;
  running: string;
  runFailed: string;
  /** Placeholders: {queries}, {zeroRate}, {p95}, {runId} */
  summary: string;
};

type SearchBenchmarkFormProps = {
  labels: SearchBenchmarkFormLabels;
};

export function SearchBenchmarkForm({ labels }: SearchBenchmarkFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/search/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetVersion: "v1" }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: {
          queryCount: number;
          zeroResultRate: number;
          latencyP95Ms: number | null;
        };
        runId?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? labels.runFailed);
        return;
      }

      const zeroPct = Math.round((payload.summary?.zeroResultRate ?? 0) * 100);
      setMessage(
        labels.summary
          .replaceAll("{queries}", String(payload.summary?.queryCount ?? 0))
          .replaceAll("{zeroRate}", String(zeroPct))
          .replaceAll(
            "{p95}",
            payload.summary?.latencyP95Ms == null
              ? "—"
              : String(payload.summary.latencyP95Ms),
          )
          .replaceAll("{runId}", payload.runId ?? "—"),
      );
      router.refresh();
    } catch {
      setError(labels.runFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPanel title={labels.title}>
      <p className="mb-3 text-[0.8125rem] text-muted-foreground">
        {labels.description}
      </p>
      <Button type="button" size="sm" disabled={busy} onClick={handleRun}>
        {busy ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            {labels.running}
          </>
        ) : (
          labels.run
        )}
      </Button>
      {message ? (
        <p className="mt-3 text-[0.8125rem] text-foreground">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-[0.8125rem] text-destructive">{error}</p>
      ) : null}
    </AdminPanel>
  );
}
