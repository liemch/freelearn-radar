"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type CandidateAction = "approve" | "reject" | "reanalyze";

type CandidateActionsLabels = {
  approve: string;
  reject: string;
  reanalyze: string;
  approving: string;
  rejecting: string;
  reanalyzing: string;
  reanalyzeHint: string;
  actionFailed: string;
};

type CandidateActionsProps = {
  candidateId: string;
  canApprove?: boolean;
  canReject?: boolean;
  canReanalyze?: boolean;
  labels: CandidateActionsLabels;
};

export function CandidateActions({
  candidateId,
  canApprove = true,
  canReject = true,
  canReanalyze = true,
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
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? labels.actionFailed);
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

  if (!canApprove && !canReject && !canReanalyze) {
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
      </div>
      {pending === "reanalyze" ? (
        <p className="text-xs text-muted-foreground" role="status">
          {labels.reanalyzeHint}
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
