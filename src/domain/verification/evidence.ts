import { z } from "zod";

/** Fine-grained evidence methods (DB enum maps AI_EXTRACTION→AI, PROVIDER_DATA→PAGE_METADATA). */
export type EvidenceMethod =
  | "SEARCH"
  | "PAGE_METADATA"
  | "PROVIDER_DATA"
  | "AI_EXTRACTION"
  | "MANUAL";

export const evidenceRecordSchema = z.object({
  type: z.enum([
    "PRICE",
    "CERTIFICATE",
    "AVAILABILITY",
    "TITLE",
    "URL",
    "METADATA",
    "OTHER",
  ]),
  sourceUrl: z.string().nullable().optional(),
  sourceProvider: z.string().nullable().optional(),
  observedValue: z.string(),
  confidence: z.number().min(0).max(1),
  observedAt: z.string(),
  method: z.enum([
    "SEARCH",
    "PAGE_METADATA",
    "PROVIDER_DATA",
    "AI_EXTRACTION",
    "MANUAL",
  ]),
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

export function createEvidence(
  partial: Omit<EvidenceRecord, "observedAt"> & { observedAt?: string | Date },
): EvidenceRecord {
  const observedAt =
    partial.observedAt instanceof Date
      ? partial.observedAt.toISOString()
      : (partial.observedAt ?? new Date().toISOString());

  return evidenceRecordSchema.parse({
    ...partial,
    observedAt,
  });
}

export function mapEvidenceMethodToDb(
  method: EvidenceMethod,
): "SEARCH" | "PAGE_METADATA" | "AI" | "MANUAL" {
  switch (method) {
    case "AI_EXTRACTION":
      return "AI";
    case "PROVIDER_DATA":
      return "PAGE_METADATA";
    default:
      return method;
  }
}

export function summarizePriceEvidence(records: EvidenceRecord[]): string {
  const price = records.filter((item) => item.type === "PRICE");
  if (price.length === 0) {
    return "No price evidence recorded";
  }
  return price
    .map(
      (item) =>
        `${item.observedValue} (${item.method}, conf ${item.confidence.toFixed(2)})`,
    )
    .join("; ");
}
