"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { AdminPanel } from "@/components/admin/admin-panel";
import { AdminStatus } from "@/components/admin/admin-status";
import { Button } from "@/components/ui/button";
import type { HealthState } from "@/domain/admin/operations-snapshot";

export type ServiceHealthRow = {
  key: string;
  label: string;
  state: HealthState;
  /** Localised name of the state, resolved on the server. */
  stateLabel: string;
  /** Pre-formatted context, e.g. "Last signal: 14/08/2026 17:26". */
  detail: string;
};

export type ServiceHealthLabels = {
  heading: string;
  description: string;
  healthy: string;
  failed: string;
  unknown: string;
  /** Name of the AI row itself. */
  aiLabel: string;
  /** Action that runs the live check; distinct from the row name. */
  recheck: string;
  checking: string;
  notChecked: string;
  checkFailed: string;
};

type DiagnoseResult = {
  ok: boolean;
  model: string;
  latencyMs?: number;
  error?: string;
};

type ServiceHealthPanelProps = {
  rows: ServiceHealthRow[];
  labels: ServiceHealthLabels;
};

/**
 * Service health as a dense list, with the AI check folded in as a row action.
 *
 * The AI connection test used to be a half-page panel of its own containing one
 * button. It belongs here: it answers the same question as every other row, and
 * a diagnostic should not outweigh the status it reports.
 *
 * Nothing here infers health from silence. The AI and search rows arrive
 * Unknown because neither records a success signal anywhere, and the AI row
 * only leaves Unknown when an operator actually runs the check — the result is
 * live state, not a stored one, so it is gone on the next page load.
 */
export function ServiceHealthPanel({ rows, labels }: ServiceHealthPanelProps) {
  const [busy, setBusy] = useState(false);
  const [aiResult, setAiResult] = useState<DiagnoseResult | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);

  async function checkAi() {
    setBusy(true);
    setAiResult(null);
    setRequestFailed(false);

    try {
      const response = await fetch("/api/admin/ai/diagnose", {
        method: "POST",
      });
      if (!response.ok) {
        setRequestFailed(true);
        return;
      }
      setAiResult((await response.json()) as DiagnoseResult);
    } catch {
      setRequestFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function aiState(): { state: HealthState; label: string; detail: string } {
    if (busy) {
      return { state: "unknown", label: labels.checking, detail: "" };
    }
    if (requestFailed) {
      return { state: "failed", label: labels.failed, detail: labels.checkFailed };
    }
    if (aiResult) {
      const latency =
        aiResult.latencyMs != null ? `${aiResult.latencyMs}ms` : "";
      const detail = [latency, aiResult.model].filter(Boolean).join(" · ");
      return aiResult.ok
        ? { state: "healthy", label: labels.healthy, detail }
        : {
            state: "failed",
            label: labels.failed,
            detail: aiResult.error?.slice(0, 120) ?? detail,
          };
    }
    return { state: "unknown", label: labels.unknown, detail: labels.notChecked };
  }

  const ai = aiState();

  return (
    <AdminPanel title={labels.heading} description={labels.description} flush>
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between gap-3 px-3.5 py-2"
          >
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium leading-tight">
                {row.label}
              </p>
              {row.detail ? (
                <p className="mt-0.5 truncate text-[0.6875rem] leading-tight text-muted-foreground">
                  {row.detail}
                </p>
              ) : null}
            </div>
            <AdminStatus state={row.state} label={row.stateLabel} />
          </li>
        ))}

        <li className="flex items-center justify-between gap-3 px-3.5 py-2">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium leading-tight">
              {labels.aiLabel}
            </p>
            {ai.detail ? (
              <p
                className="mt-0.5 truncate text-[0.6875rem] leading-tight text-muted-foreground"
                title={ai.detail}
              >
                {ai.detail}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AdminStatus state={ai.state} label={ai.label} />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={checkAi}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : null}
              {busy ? labels.checking : labels.recheck}
            </Button>
          </div>
        </li>
      </ul>
    </AdminPanel>
  );
}
