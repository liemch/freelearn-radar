"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CandidateActions } from "@/components/admin/candidate-actions";

export type BulkCandidateRow = {
  id: string;
  title: string;
  provider: string;
  canonicalUrl: string;
  description: string | null;
  statusLabel: string;
  statusVariant: BadgeProps["variant"];
  canApprove: boolean;
  canReject: boolean;
  canReanalyze: boolean;
};

type BulkLabels = {
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
  bulkApprove: string;
  bulkReject: string;
  bulkApproving: string;
  bulkRejecting: string;
  bulkSelected: string;
  bulkNoneSelected: string;
  bulkFailed: string;
  bulkSummary: string;
  selectAll: string;
};

type CandidateBulkListProps = {
  candidates: BulkCandidateRow[];
  labels: BulkLabels;
};

export function CandidateBulkList({
  candidates,
  labels,
}: CandidateBulkListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectableIds = useMemo(
    () =>
      candidates
        .filter((c) => c.canApprove || c.canReject)
        .map((c) => c.id),
    [candidates],
  );

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      if (selectableIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(selectableIds);
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "approve" | "reject") {
    const ids = [...selected].slice(0, 50);
    if (ids.length === 0) {
      setError(labels.bulkNoneSelected);
      return;
    }

    setBusyAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/candidates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ids,
          reason: action === "reject" ? "Bulk rejected by admin" : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        results?: Array<{ ok: boolean }>;
      };

      if (!response.ok) {
        setError(payload.error ?? labels.bulkFailed);
        return;
      }

      const ok = payload.results?.filter((r) => r.ok).length ?? 0;
      const failed = (payload.results?.length ?? 0) - ok;
      setMessage(
        labels.bulkSummary
          .replaceAll("{ok}", String(ok))
          .replaceAll("{failed}", String(failed)),
      );
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch {
      setError(labels.bulkFailed);
    } finally {
      setBusyAction(null);
    }
  }

  const actionLabels = {
    approve: labels.approve,
    reject: labels.reject,
    reanalyze: labels.reanalyze,
    approving: labels.approving,
    rejecting: labels.rejecting,
    reanalyzing: labels.reanalyzing,
    reanalyzeHint: labels.reanalyzeHint,
    refreshSource: labels.refreshSource,
    refreshingSource: labels.refreshingSource,
    refreshSourceHint: labels.refreshSourceHint,
    actionFailed: labels.actionFailed,
    actionTimedOut: labels.actionTimedOut,
  };

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3.5 py-2">
        <label className="flex items-center gap-2 text-[0.8125rem]">
          <input
            type="checkbox"
            className="size-3.5 rounded border-input"
            checked={allSelected}
            onChange={toggleAll}
            disabled={selectableIds.length === 0 || busyAction !== null}
          />
          <span>
            {labels.selectAll}
            {selected.size > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                · {selected.size} {labels.bulkSelected}
              </span>
            ) : null}
          </span>
        </label>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={busyAction !== null || pending}
            onClick={() => void runBulk("approve")}
          >
            {busyAction === "approve" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            {busyAction === "approve"
              ? labels.bulkApproving
              : labels.bulkApprove}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyAction !== null || pending}
            onClick={() => void runBulk("reject")}
          >
            {busyAction === "reject" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : null}
            {busyAction === "reject"
              ? labels.bulkRejecting
              : labels.bulkReject}
          </Button>
        </div>
      </div>

      {message || error ? (
        <div className="border-b border-border/60 px-3.5 py-2 text-xs">
          {message ? (
            <p className="text-foreground" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive-foreground" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="divide-y divide-border/60">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3 transition hover:bg-muted/40"
          >
            <div className="flex min-w-0 flex-1 gap-2.5">
              <input
                type="checkbox"
                className="mt-1 size-3.5 shrink-0 rounded border-input"
                checked={selected.has(candidate.id)}
                disabled={
                  !(candidate.canApprove || candidate.canReject) ||
                  busyAction !== null
                }
                onChange={() => toggleOne(candidate.id)}
                aria-label={candidate.title}
              />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/admin/candidates/${candidate.id}`}
                    className="text-[0.8125rem] font-semibold hover:text-primary"
                  >
                    {candidate.title}
                  </a>
                  <Badge variant={candidate.statusVariant}>
                    {candidate.statusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {candidate.provider}
                </p>
                <a
                  href={candidate.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-[0.6875rem] text-primary"
                >
                  {candidate.canonicalUrl}
                </a>
                {candidate.description ? (
                  <p className="max-w-3xl text-xs text-muted-foreground">
                    {candidate.description}
                  </p>
                ) : null}
              </div>
            </div>
            <CandidateActions
              candidateId={candidate.id}
              canApprove={candidate.canApprove}
              canReject={candidate.canReject}
              canReanalyze={candidate.canReanalyze}
              canRefreshSource={false}
              labels={actionLabels}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
