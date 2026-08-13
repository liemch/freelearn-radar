"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type DiscoveryRunFormProps = {
  providers: string[];
  categories: string[];
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function DiscoveryRunForm({
  providers,
  categories,
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
        setError(payload.error ?? "Discovery failed");
        return;
      }

      setMessage(
        `Queries ${payload.summary?.queriesProcessed ?? 0}, created ${payload.summary?.created ?? 0}, duplicates ${payload.summary?.duplicates ?? 0}, invalid ${payload.summary?.invalid ?? 0}, errors ${payload.summary?.errors ?? 0}`,
      );
    } catch {
      setError("Discovery failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Run discovery</h2>
        <p className="text-sm text-muted-foreground">
          Runs the next due discovery queries through the search provider, then
          creates candidates. Requires TAVILY_API_KEY.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="discovery-topic">Topic</Label>
          <select
            id="discovery-topic"
            className={selectClass}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All topics</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discovery-provider">Provider</Label>
          <select
            id="discovery-provider"
            className={selectClass}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="">All providers</option>
            {providers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discovery-limit">Query limit</Label>
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
        {busy ? "Running..." : "Run Discovery"}
      </Button>
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
