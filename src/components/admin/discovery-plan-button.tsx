"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type PlanStep = {
  order: number;
  provider: string;
  query: string;
  maxResults: number;
  providerHealth: string;
  why: string;
};

type Plan = {
  categorySlug: string;
  categoryName: string;
  coverage: string;
  publishedEligible: number;
  priority: string;
  reason: string;
  demandBand: string;
  steps: PlanStep[];
  totals: { queries: number; maxCandidates: number };
  warnings: string[];
  mutatesDatabase: false;
};

type Labels = {
  viewPlan: string;
  hidePlan: string;
  runDiscovery: string;
  loading: string;
  failed: string;
  noMutate: string;
  queries: string;
  maxCandidates: string;
  provider: string;
  health: string;
};

type Props = {
  categorySlug: string;
  labels: Labels;
};

export function DiscoveryPlanButton({ categorySlug, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan() {
    if (open) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/discovery/plan?category=${encodeURIComponent(categorySlug)}`,
      );
      const payload = (await res.json()) as { plan?: Plan; error?: string };
      if (!res.ok || !payload.plan) {
        setError(payload.error ?? labels.failed);
        setOpen(true);
        return;
      }
      setPlan(payload.plan);
      setOpen(true);
    } catch {
      setError(labels.failed);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void loadPlan()}
        >
          {busy ? labels.loading : open ? labels.hidePlan : labels.viewPlan}
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link
            href={`/admin/discovery?category=${encodeURIComponent(categorySlug)}`}
          >
            {labels.runDiscovery}
          </Link>
        </Button>
      </div>
      {open ? (
        <div className="rounded border border-border bg-muted/30 p-3 text-xs">
          {error ? (
            <p className="text-amber-700 dark:text-amber-400">{error}</p>
          ) : plan ? (
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                {plan.categoryName} · {plan.priority} · {plan.coverage} · demand{" "}
                {plan.demandBand}
              </p>
              <p className="text-muted-foreground">{plan.reason}</p>
              <p>
                {labels.queries}: {plan.totals.queries} · {labels.maxCandidates}:{" "}
                {plan.totals.maxCandidates}
              </p>
              <p className="text-emerald-700 dark:text-emerald-400">
                {labels.noMutate}
              </p>
              {plan.warnings.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-amber-800 dark:text-amber-300">
                  {plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <ol className="list-decimal space-y-2 pl-4">
                {plan.steps.map((step) => (
                  <li key={step.query}>
                    <span className="font-medium">
                      {labels.provider} {step.provider}
                    </span>{" "}
                    ({labels.health}: {step.providerHealth}) — max{" "}
                    {step.maxResults}
                    <div className="mt-0.5 break-all text-muted-foreground">
                      {step.query}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
