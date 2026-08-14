import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { CandidateActions } from "@/components/admin/candidate-actions";
import { CandidateSourceImage } from "@/components/admin/candidate-source-image";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { getDb } from "@/db";
import { findCandidateById } from "@/db/repositories/candidate-repository";
import type { DiscoveryStatus } from "@/domain/course/types";
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

/** Label/value pair at the density of the rest of the admin console. */
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-[0.8125rem]">{children}</div>
    </div>
  );
}

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
    refreshSource: t.candidates.refreshSource,
    refreshingSource: t.candidates.refreshingSource,
    refreshSourceHint: t.candidates.refreshSourceHint,
    actionFailed: t.candidates.actionFailed,
    actionTimedOut: t.candidates.actionTimedOut,
  };

  return (
    <>
      <AdminPageHeader
        title={candidate.rawTitle || t.candidates.untitled}
        meta={
          <>
            <Badge
              variant={discoveryStatusVariant(candidate.discoveryStatus)}
            >
              {getDiscoveryStatusLabel(candidate.discoveryStatus)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {candidate.provider || t.common.unknown}
            </span>
          </>
        }
        actions={
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
            canRefreshSource={
              candidate.discoveryStatus === "DISCOVERED" ||
              candidate.discoveryStatus === "FETCHED" ||
              candidate.discoveryStatus === "ANALYZED" ||
              candidate.discoveryStatus === "READY_FOR_REVIEW" ||
              candidate.discoveryStatus === "ERROR"
            }
            labels={actionLabels}
          />
        }
      />

      <div className="space-y-4">
        <AdminPanel>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label={t.common.status}>
              <Badge
                variant={discoveryStatusVariant(candidate.discoveryStatus)}
              >
                {getDiscoveryStatusLabel(candidate.discoveryStatus)}
              </Badge>
              <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">
                {candidate.discoveryStatus}
              </p>
            </Field>
            <Field label={t.candidates.source}>
              <p className="font-medium">{candidate.sourceType}</p>
              {candidate.searchQuery ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.candidates.query}: {candidate.searchQuery}
                </p>
              ) : null}
            </Field>
            <Field label={t.candidates.providerHint}>
              <p className="font-medium">
                {candidate.provider || t.common.unknown}
              </p>
            </Field>
            <Field label={t.candidates.aiConfidence}>
              <p className="font-medium tabular-nums">
                {candidate.confidence ?? t.candidates.notAvailable} · {band}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {confidenceLabel(band)}
              </p>
            </Field>
            <Field label={t.courses.canonicalUrl} wide>
              <a
                href={candidate.canonicalUrl}
                className="break-all text-primary"
                target="_blank"
                rel="noreferrer"
              >
                {candidate.canonicalUrl}
              </a>
            </Field>
            {candidate.sourceFinalUrl ? (
              <Field label={t.candidates.finalSourceUrl} wide>
                <a
                  href={candidate.sourceFinalUrl}
                  className="break-all text-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  {candidate.sourceFinalUrl}
                </a>
                {candidate.sourceFetchedAt ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.candidates.fetchedAt}:{" "}
                    {candidate.sourceFetchedAt.toISOString()}
                  </p>
                ) : null}
              </Field>
            ) : null}
            {candidate.sourceImageUrl ? (
              <Field label={t.candidates.imageSource} wide>
                <a
                  href={candidate.sourceImageUrl}
                  className="break-all text-primary"
                  target="_blank"
                  rel="noreferrer"
                >
                  {candidate.sourceImageUrl}
                </a>
                <CandidateSourceImage
                  src={candidate.sourceImageUrl}
                  alt={t.candidates.imagePreview}
                />
              </Field>
            ) : candidate.sourceFetchedAt ? (
              <p className="text-[0.8125rem] text-muted-foreground sm:col-span-2">
                {t.candidates.noSourceImage}
              </p>
            ) : null}
            {candidate.errorMessage ? (
              <p className="text-[0.8125rem] text-destructive sm:col-span-2">
                {candidate.errorMessage}
              </p>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel
          title={t.candidates.whyClassification}
          description={t.candidates.whyClassificationDescription}
        >
          <dl className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.candidates.freeStatus}
              </dt>
              <dd className="mt-1 text-[0.8125rem] font-medium">
                {getPriceTypeLabel(free.priceType).label}
              </dd>
              <dd className="text-xs text-muted-foreground">{free.rationale}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.courses.certificate}
              </dt>
              <dd className="mt-1 text-[0.8125rem] font-medium">
                {getCertificateTypeLabel(certificate.certificateType)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {certificate.rationale}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {t.candidates.evidence}: {summarizePriceEvidence(evidencePreview)}
          </p>
          {analysis?.price_type ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
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
        </AdminPanel>

        <AdminPanel title={t.candidates.sourceEvidence}>
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[0.8125rem] text-muted-foreground">
            {(candidate.rawContent || candidate.rawDescription || "").slice(
              0,
              4000,
            ) || t.candidates.noRawContent}
          </p>
        </AdminPanel>

        <details className="overflow-hidden rounded-md border border-border bg-card">
          <summary className="cursor-pointer px-3.5 py-2.5 text-[0.8125rem] font-semibold">
            {t.candidates.technicalDetails}
          </summary>
          <pre className="overflow-x-auto border-t border-border bg-muted p-3 text-[0.6875rem]">
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
      </div>
    </>
  );
}
