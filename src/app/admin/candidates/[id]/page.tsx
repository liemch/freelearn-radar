import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CandidateActions } from "@/components/admin/candidate-actions";
import { getDb } from "@/db";
import { findCandidateById } from "@/db/repositories/candidate-repository";
import {
  getCertificateTypeLabel,
  getDiscoveryStatusLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";
import {
  canApproveCandidate,
  canRejectCandidate,
} from "@/domain/course/transitions";
import {
  confidenceBand,
  confidenceLabel,
} from "@/domain/quality/confidence";
import { classifyCertificateFromText } from "@/domain/verification/certificate-status";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { summarizePriceEvidence, createEvidence } from "@/domain/verification/evidence";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCandidateDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const { id } = await params;
  let candidate = null;
  try {
    candidate = await findCandidateById(getDb(), id);
  } catch {
    notFound();
  }

  if (!candidate) notFound();

  const analysis =
    candidate.aiAnalysisJson && typeof candidate.aiAnalysisJson === "object"
      ? (candidate.aiAnalysisJson as Record<string, unknown>)
      : null;

  const evidenceText = [
    candidate.rawTitle,
    candidate.rawDescription,
    candidate.rawContent,
  ]
    .filter(Boolean)
    .join("\n");

  const free = classifyFreeStatusFromText(evidenceText);
  const certificate = classifyCertificateFromText(evidenceText);
  const band = confidenceBand(candidate.confidence);
  const evidencePreview = [
    createEvidence({
      type: "PRICE",
      sourceUrl: candidate.canonicalUrl,
      sourceProvider: candidate.provider,
      observedValue: `${free.priceType}: ${free.rationale}`,
      confidence: free.confidence,
      method: "SEARCH",
    }),
    createEvidence({
      type: "CERTIFICATE",
      sourceUrl: candidate.canonicalUrl,
      sourceProvider: candidate.provider,
      observedValue: `${certificate.certificateType}: ${certificate.rationale}`,
      confidence: certificate.confidence,
      method: "SEARCH",
    }),
  ];

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/candidates" className="hover:underline">
                {t.nav.candidates}
              </Link>{" "}
              / {t.candidates.detail}
            </p>
            <h1 className="text-xl font-semibold">
              {candidate.rawTitle || t.candidates.untitled}
            </h1>
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
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">{t.common.status}</p>
            <p className="font-medium">
              {getDiscoveryStatusLabel(candidate.discoveryStatus)}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {candidate.discoveryStatus}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t.candidates.source}</p>
            <p className="font-medium">{candidate.sourceType}</p>
            {candidate.searchQuery ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t.candidates.query}: {candidate.searchQuery}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t.candidates.providerHint}
            </p>
            <p className="font-medium">
              {candidate.provider || t.common.unknown}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t.candidates.aiConfidence}
            </p>
            <p className="font-medium">
              {candidate.confidence ?? t.candidates.notAvailable} · {band}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {confidenceLabel(band)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">
              {t.courses.canonicalUrl}
            </p>
            <a
              href={candidate.canonicalUrl}
              className="break-all text-sm text-primary"
              target="_blank"
              rel="noreferrer"
            >
              {candidate.canonicalUrl}
            </a>
          </div>
          {candidate.sourceFinalUrl ? (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {t.candidates.finalSourceUrl}
              </p>
              <a
                href={candidate.sourceFinalUrl}
                className="break-all text-sm text-primary"
                target="_blank"
                rel="noreferrer"
              >
                {candidate.sourceFinalUrl}
              </a>
              {candidate.sourceFetchedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.candidates.fetchedAt}:{" "}
                  {candidate.sourceFetchedAt.toISOString()}
                </p>
              ) : null}
            </div>
          ) : null}
          {candidate.sourceImageUrl ? (
            <div className="sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                {t.candidates.imageSource}
              </p>
              <a
                href={candidate.sourceImageUrl}
                className="break-all text-sm text-primary"
                target="_blank"
                rel="noreferrer"
              >
                {candidate.sourceImageUrl}
              </a>
            </div>
          ) : null}
          {candidate.errorMessage ? (
            <p className="sm:col-span-2 text-sm text-destructive">
              {candidate.errorMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="font-semibold">{t.candidates.whyClassification}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.candidates.whyClassificationDescription}
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {t.candidates.freeStatus}
              </dt>
              <dd className="font-medium">
                {getPriceTypeLabel(free.priceType).label}
              </dd>
              <dd className="text-xs text-muted-foreground">{free.rationale}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.courses.certificate}</dt>
              <dd className="font-medium">
                {getCertificateTypeLabel(certificate.certificateType)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {certificate.rationale}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            {t.candidates.evidence}: {summarizePriceEvidence(evidencePreview)}
          </p>
          {analysis?.price_type ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t.candidates.aiSuggestionNote
                .replaceAll("{price}", String(analysis.price_type))
                .replaceAll(
                  "{certificate}",
                  String(
                    analysis.certificate_type ?? t.candidates.notAvailable,
                  ),
                )}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="font-semibold">{t.candidates.sourceEvidence}</h2>
          <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {(candidate.rawContent || candidate.rawDescription || "").slice(
              0,
              4000,
            ) || t.candidates.noRawContent}
          </p>
        </section>

        <details className="rounded-xl border border-border p-5">
          <summary className="cursor-pointer font-semibold">
            {t.candidates.technicalDetails}
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(
              {
                sourceFetch: candidate.sourceEvidenceJson ?? null,
                aiAnalysis: analysis,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </main>
    </div>
  );
}
