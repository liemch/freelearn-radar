import Link from "next/link";
import { redirect } from "next/navigation";

import { CandidateActions } from "@/components/admin/candidate-actions";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { EmptyState } from "@/components/public/empty-state";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.nav.candidates}
            </p>
            <h1 className="text-xl font-semibold">{t.candidates.review}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/discovery">{t.nav.discovery}</Link>
            </Button>
            <AdminLogoutButton
              label={t.common.signOut}
              signingOutLabel={t.common.signingOut}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <div className="flex flex-wrap gap-2">
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

        {candidates.map((candidate) => (
          <article
            key={candidate.id}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <Link
                  href={`/admin/candidates/${candidate.id}`}
                  className="text-lg font-semibold hover:text-primary"
                >
                  {candidate.rawTitle || candidate.canonicalUrl}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {candidate.provider || t.candidates.unknownProvider} ·{" "}
                  {getDiscoveryStatusLabel(candidate.discoveryStatus)}
                </p>
                <a
                  href={candidate.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary break-all"
                >
                  {candidate.canonicalUrl}
                </a>
                {candidate.rawDescription ? (
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
                labels={actionLabels}
              />
            </div>
          </article>
        ))}

        {candidates.length === 0 ? (
          <EmptyState
            title={t.candidates.emptyTitle}
            description={t.candidates.emptyDescription}
            actionHref="/admin/discovery"
            actionLabel={t.candidates.openDiscovery}
          />
        ) : null}
      </main>
    </div>
  );
}
