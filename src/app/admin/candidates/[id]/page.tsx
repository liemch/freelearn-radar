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
  confidenceBand,
  confidenceLabel,
} from "@/domain/quality/confidence";
import { classifyCertificateFromText } from "@/domain/verification/certificate-status";
import { classifyFreeStatusFromText } from "@/domain/verification/free-status";
import { summarizePriceEvidence, createEvidence } from "@/domain/verification/evidence";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCandidateDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin/candidates" className="hover:underline">
                Candidates
              </Link>{" "}
              / Detail
            </p>
            <h1 className="text-xl font-semibold">
              {candidate.rawTitle || "Untitled candidate"}
            </h1>
          </div>
          <CandidateActions
            candidateId={candidate.id}
            canApprove={
              candidate.discoveryStatus === "READY_FOR_REVIEW" ||
              candidate.discoveryStatus === "ANALYZED"
            }
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="grid gap-4 rounded-xl border border-border p-5 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">
              {getDiscoveryStatusLabel(candidate.discoveryStatus)}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {candidate.discoveryStatus}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Source</p>
            <p className="font-medium">{candidate.sourceType}</p>
            {candidate.searchQuery ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Query: {candidate.searchQuery}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Provider hint</p>
            <p className="font-medium">{candidate.provider || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">AI confidence</p>
            <p className="font-medium">
              {candidate.confidence ?? "n/a"} · {band}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {confidenceLabel(band)}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Canonical URL</p>
            <a
              href={candidate.canonicalUrl}
              className="break-all text-sm text-primary"
              target="_blank"
              rel="noreferrer"
            >
              {candidate.canonicalUrl}
            </a>
          </div>
          {candidate.errorMessage ? (
            <p className="sm:col-span-2 text-sm text-destructive">
              {candidate.errorMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="font-semibold">Why this classification</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deterministic text evidence drives free/certificate labels. AI is a
            fallback when evidence is weak.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Free status</dt>
              <dd className="font-medium">
                {getPriceTypeLabel(free.priceType).label}
              </dd>
              <dd className="text-xs text-muted-foreground">{free.rationale}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Certificate</dt>
              <dd className="font-medium">
                {getCertificateTypeLabel(certificate.certificateType)}
              </dd>
              <dd className="text-xs text-muted-foreground">
                {certificate.rationale}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Evidence: {summarizePriceEvidence(evidencePreview)}
          </p>
          {analysis?.price_type ? (
            <p className="mt-2 text-xs text-muted-foreground">
              AI suggested price={String(analysis.price_type)}, certificate=
              {String(analysis.certificate_type ?? "n/a")} — used only when text
              evidence is weak.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="font-semibold">Source evidence</h2>
          <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {(candidate.rawContent || candidate.rawDescription || "").slice(
              0,
              4000,
            ) || "No raw content captured."}
          </p>
        </section>

        <details className="rounded-xl border border-border p-5">
          <summary className="cursor-pointer font-semibold">
            Technical details (AI JSON)
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {analysis ? JSON.stringify(analysis, null, 2) : "No analysis yet"}
          </pre>
        </details>
      </main>
    </div>
  );
}
