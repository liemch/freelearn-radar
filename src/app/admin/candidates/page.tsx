import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { CandidateActions } from "@/components/admin/candidate-actions";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listCandidates } from "@/db/repositories/candidate-repository";
import { isAutoRejectedCandidate } from "@/domain/candidate/auto-reject";
import { sortCandidatesForReview } from "@/domain/candidate/review-priority";
import type { DiscoveryStatus } from "@/domain/course/types";
import { getDiscoveryStatusLabel } from "@/domain/course/labels";
import {
  canApproveCandidate,
  canRejectCandidate,
} from "@/domain/course/transitions";
import { AI_CONFIDENCE } from "@/domain/quality/confidence";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

/** Queue for human review — hide terminal statuses after reject/approve. */
const REVIEW_QUEUE_STATUSES = new Set<DiscoveryStatus>([
  "DISCOVERED",
  "FETCHED",
  "ANALYZED",
  "READY_FOR_REVIEW",
  "ERROR",
]);

function discoveryStatusVariant(
  status: DiscoveryStatus,
): BadgeProps["variant"] {
  switch (status) {
    case "READY_FOR_REVIEW":
      return "info";
    case "APPROVED":
    case "PUBLISHED":
      return "success";
    case "ERROR":
    case "INVALID":
      return "danger";
    case "REJECTED":
    case "DUPLICATE":
    case "EXPIRED":
    case "EXPIRED_UNREVIEWED":
      return "outline";
    default:
      return "neutral";
  }
}

type CandidateView =
  | "all"
  | "error"
  | "ready"
  | "low_confidence"
  | "auto_rejected"
  | "expired";

function parseView(raw: string | string[] | undefined): CandidateView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  switch (value) {
    case "error":
    case "ready":
    case "low_confidence":
    case "auto_rejected":
    case "expired":
      return value;
    default:
      return "all";
  }
}

function confidenceOf(confidence: string | null, aiJson: unknown): number {
  const fromColumn = Number(confidence);
  if (Number.isFinite(fromColumn)) return fromColumn;
  if (aiJson && typeof aiJson === "object" && aiJson !== null) {
    const fromJson = Number((aiJson as Record<string, unknown>).confidence);
    if (Number.isFinite(fromJson)) return fromJson;
  }
  return Number.NaN;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCandidatesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;
  const view = parseView(params.view);

  let candidates: Awaited<ReturnType<typeof listCandidates>> = [];
  try {
    const all = await listCandidates(getDb(), { limit: 300 });

    if (view === "expired") {
      candidates = all.filter(
        (candidate) => candidate.discoveryStatus === "EXPIRED_UNREVIEWED",
      );
    } else if (view === "auto_rejected") {
      candidates = all.filter(isAutoRejectedCandidate);
    } else {
      candidates = all.filter((candidate) =>
        REVIEW_QUEUE_STATUSES.has(candidate.discoveryStatus),
      );
      if (view === "error") {
        candidates = candidates.filter((c) => c.discoveryStatus === "ERROR");
      } else if (view === "ready") {
        candidates = candidates.filter(
          (c) => c.discoveryStatus === "READY_FOR_REVIEW",
        );
      } else if (view === "low_confidence") {
        candidates = candidates.filter((c) => {
          const conf = confidenceOf(c.confidence, c.aiAnalysisJson);
          return (
            Number.isFinite(conf) && conf < AI_CONFIDENCE.REVIEW_THRESHOLD
          );
        });
      }
    }

    candidates = sortCandidatesForReview(candidates);
  } catch {
    candidates = [];
  }

  const actionLabels = {
    approve: t.candidates.approve,
    reject: t.candidates.reject,
    reanalyze: t.candidates.reanalyze,
    approving: t.candidates.approving,
    rejecting: t.candidates.rejecting,
    reanalyzing: t.candidates.reanalyzing,
    reanalyzeHint: t.candidates.reanalyzeHint,
    refreshSource: t.candidates.refreshSource,
    refreshingSource: t.candidates.refreshingSource,
    refreshSourceHint: t.candidates.refreshSourceHint,
    actionFailed: t.candidates.actionFailed,
    actionTimedOut: t.candidates.actionTimedOut,
  };

  const views: Array<{ key: CandidateView; label: string; href: string }> = [
    { key: "all", label: t.candidates.viewAll, href: "/admin/candidates" },
    {
      key: "error",
      label: t.candidates.viewError,
      href: "/admin/candidates?view=error",
    },
    {
      key: "ready",
      label: t.candidates.viewReady,
      href: "/admin/candidates?view=ready",
    },
    {
      key: "low_confidence",
      label: t.candidates.viewLowConfidence,
      href: "/admin/candidates?view=low_confidence",
    },
    {
      key: "auto_rejected",
      label: t.candidates.viewAutoRejected,
      href: "/admin/candidates?view=auto_rejected",
    },
    {
      key: "expired",
      label: t.candidates.viewExpired,
      href: "/admin/candidates?view=expired",
    },
  ];

  const activeView = views.find((item) => item.key === view) ?? views[0];

  return (
    <>
      <AdminPageHeader
        title={t.candidates.review}
        description={t.candidates.description}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/discovery">{t.nav.discovery}</Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {views.map((item) => (
            <Button
              key={item.key}
              asChild
              size="sm"
              variant={view === item.key ? "default" : "outline"}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>

        <AdminPanel
          title={activeView.label}
          actions={<Badge variant="outline">{candidates.length}</Badge>}
          flush
        >
          {candidates.length === 0 ? (
            <AdminEmptyState
              message={t.candidates.emptyTitle}
              hint={t.candidates.emptyDescription}
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/admin/discovery">
                    {t.candidates.openDiscovery}
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3 transition hover:bg-muted/40"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/candidates/${candidate.id}`}
                        className="text-[0.8125rem] font-semibold hover:text-primary"
                      >
                        {candidate.rawTitle || candidate.canonicalUrl}
                      </Link>
                      <Badge
                        variant={discoveryStatusVariant(
                          candidate.discoveryStatus,
                        )}
                      >
                        {getDiscoveryStatusLabel(candidate.discoveryStatus)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {candidate.provider || t.candidates.unknownProvider}
                    </p>
                    <a
                      href={candidate.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-[0.6875rem] text-primary"
                    >
                      {candidate.canonicalUrl}
                    </a>
                    {candidate.rawDescription ? (
                      <p className="max-w-3xl text-xs text-muted-foreground">
                        {candidate.rawDescription.slice(0, 240)}
                      </p>
                    ) : null}
                  </div>
                  <CandidateActions
                    candidateId={candidate.id}
                    canApprove={canApproveCandidate(candidate.discoveryStatus)}
                    canReject={canRejectCandidate(candidate.discoveryStatus)}
                    canReanalyze={
                      candidate.discoveryStatus === "DISCOVERED" ||
                      candidate.discoveryStatus === "FETCHED" ||
                      candidate.discoveryStatus === "ANALYZED" ||
                      candidate.discoveryStatus === "READY_FOR_REVIEW" ||
                      candidate.discoveryStatus === "ERROR"
                    }
                    canRefreshSource={false}
                    labels={actionLabels}
                  />
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
