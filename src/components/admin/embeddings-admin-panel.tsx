"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type QueueSnapshot = {
  PENDING: number;
  OK: number;
  FAILED: number;
  STALE: number;
};

type EmbeddingsAdminPanelProps = {
  initialQueue: QueueSnapshot;
  labels: {
    pending: string;
    ok: string;
    failed: string;
    stale: string;
    enqueue: string;
    run: string;
    running: string;
    failedAction: string;
  };
};

export function EmbeddingsAdminPanel({
  initialQueue,
  labels,
}: EmbeddingsAdminPanelProps) {
  const router = useRouter();
  const [queue, setQueue] = useState(initialQueue);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"enqueue" | "run" | null>(null);
  const [pending, startTransition] = useTransition();

  async function run(action: "enqueue" | "run") {
    setBusy(action);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        queue?: QueueSnapshot;
        enqueued?: number;
        summary?: { embedded?: number; failed?: number; skipped?: number };
      };
      if (!response.ok) {
        setError(payload.error ?? labels.failedAction);
        return;
      }
      if (payload.queue) setQueue(payload.queue);
      if (action === "enqueue") {
        setMessage(`Enqueued ${payload.enqueued ?? 0}`);
      } else {
        setMessage(
          `Embedded ${payload.summary?.embedded ?? 0}, failed ${payload.summary?.failed ?? 0}, skipped ${payload.summary?.skipped ?? 0}`,
        );
      }
      startTransition(() => router.refresh());
    } catch {
      setError(labels.failedAction);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            ["pending", queue.PENDING],
            ["ok", queue.OK],
            ["failed", queue.FAILED],
            ["stale", queue.STALE],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="rounded border border-border bg-card px-3 py-2"
          >
            <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              {labels[key]}
            </p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null || pending}
          onClick={() => void run("enqueue")}
        >
          {busy === "enqueue" ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : null}
          {labels.enqueue}
        </Button>
        <Button
          size="sm"
          disabled={busy !== null || pending}
          onClick={() => void run("run")}
        >
          {busy === "run" ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : null}
          {busy === "run" ? labels.running : labels.run}
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
