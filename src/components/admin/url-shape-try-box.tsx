"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Classification = {
  class: string;
  providerSlug: string | null;
  matchedRule: string | null;
  reason: string;
};

type UrlShapeTryBoxProps = {
  labels: {
    tryUrl: string;
    tryUrlHint: string;
    classify: string;
    classifying: string;
  };
};

export function UrlShapeTryBox({ labels }: UrlShapeTryBoxProps) {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClassify() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/url-shape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        classification?: Classification;
        error?: string;
      };
      if (!response.ok || !payload.classification) {
        setError(payload.error || "Failed");
        return;
      }
      setResult(payload.classification);
    } catch {
      setError("Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{labels.tryUrl}</h2>
        <p className="text-sm text-muted-foreground">{labels.tryUrlHint}</p>
      </div>
      <input
        type="url"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        placeholder="https://"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending || !url.trim()}
        onClick={onClassify}
      >
        {pending ? labels.classifying : labels.classify}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
