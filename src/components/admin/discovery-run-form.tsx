"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DiscoveryRunForm() {
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
        body: JSON.stringify({ limit: 5, resultLimit: 5 }),
      });
      const payload = (await response.json()) as {
        error?: string;
        summary?: {
          created: number;
          duplicates: number;
          invalid: number;
          errors: number;
        };
        pendingManualIntegrationTest?: boolean;
      };

      if (!response.ok) {
        setError(payload.error ?? "Discovery failed");
        return;
      }

      setMessage(
        `Created ${payload.summary?.created ?? 0}, duplicates ${payload.summary?.duplicates ?? 0}, invalid ${payload.summary?.invalid ?? 0}, errors ${payload.summary?.errors ?? 0}`,
      );
    } catch {
      setError("Discovery failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Run discovery</h2>
      <p className="text-sm text-muted-foreground">
        Runs the next due discovery queries through Tavily, then creates
        candidates. Requires TAVILY_API_KEY.
      </p>
      <Button onClick={handleRun} disabled={busy}>
        {busy ? "Running..." : "Run Discovery"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
