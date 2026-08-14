"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type CandidateAction = "approve" | "reject" | "reanalyze" | "refreshSource";

type CandidateActionsLabels = {
  approve: string;
  reject: string;
  reanalyze: string;
  approving: string;
  rejecting: string;
  reanalyzing: string;
  reanalyzeHint: string;
  refreshSource: string;
  refreshingSource: string;
  refreshSourceHint: string;
  actionFailed: string;
  actionTimedOut: string;
};

/**
 * A gateway timeout returns an HTML body, so response.json() throws and the real
 * status is lost. Read the status first and only then try to parse.
 */
async function readActionError(
  response: Response,
  labels: { actionFailed: string; actionTimedOut: string },
): Promise<string | null> {
  if (response.ok) return null;

  let detail = "";
  try {
    const payload = (await response.clone().json()) as { error?: string };
    detail = payload.error ?? "";
  } catch {
    detail = "";
  }

  if (response.status === 504 || response.status === 408) {
    return labels.actionTimedOut;
  }

  return detail || `${labels.actionFailed} (HTTP ${response.status})`;
}

type CandidateActionsProps = {
  candidateId: string;
  canApprove?: boolean;
  canReject?: boolean;
  canReanalyze?: boolean;
  canRefreshSource?: boolean;
  labels: CandidateActionsLabels;
};

export function CandidateActions({
  candidateId,
  canApprove = true,
  canReject = true,
  canReanalyze = true,
  canRefreshSource = true,
  labels,
}: CandidateActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<CandidateAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // router.refresh() is async; keep the spinner up until the new data paints.
  const [isRefreshing, startTransition] = useTransition();

  const busy = pending !== null || isRefreshing;

  async function run(action: CandidateAction) {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? "Rejected by admin" : undefined,
        }),
      });
      const failure = await readActionError(response, labels);
      if (failure) {
        setError(failure);
        return;
      }
      if (action === "approve") {
        router.push("/admin/courses");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError(labels.actionFailed);
    } finally {
      setPending(null);
    }
  }

  if (!canApprove && !canReject && !canReanalyze && !canRefreshSource) {
    return null;
  }

  function actionButton(
    action: CandidateAction,
    variant: "default" | "destructive" | "secondary",
    idleLabel: string,
    pendingLabel: string,
  ) {
    const isPending = pending === action;
    return (
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        aria-busy={isPending}
        onClick={() => run(action)}
      >
        {isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {isPending ? pendingLabel : idleLabel}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canApprove
          ? actionButton("approve", "default", labels.approve, labels.approving)
          : null}
        {canReject
          ? actionButton("reject", "destructive", labels.reject, labels.rejecting)
          : null}
        {canReanalyze
          ? actionButton(
              "reanalyze",
              "secondary",
              labels.reanalyze,
              labels.reanalyzing,
            )
          : null}
        {canRefreshSource
          ? actionButton(
              "refreshSource",
              "secondary",
              labels.refreshSource,
              labels.refreshingSource,
            )
          : null}
      </div>
      {pending === "reanalyze" ? (
        <p className="text-xs text-muted-foreground" role="status">
          {labels.reanalyzeHint}
        </p>
      ) : null}
      {pending === "refreshSource" ? (
        <p className="text-xs text-muted-foreground" role="status">
          {labels.refreshSourceHint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
