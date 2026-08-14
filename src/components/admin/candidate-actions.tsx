"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CandidateActionsLabels = {
  approve: string;
  reject: string;
  reanalyze: string;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "reanalyze") {
    setBusy(true);
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
      router.refresh();
      if (action === "approve") {
        router.push("/admin/courses");
      }
    } catch {
      setError(labels.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!canApprove && !canReject && !canReanalyze) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <Button size="sm" disabled={busy} onClick={() => run("approve")}>
            {labels.approve}
          </Button>
        ) : null}
        {canReject ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => run("reject")}
          >
            {labels.reject}
          </Button>
        ) : null}
        {canReanalyze ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => run("reanalyze")}
          >
            {labels.reanalyze}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
