import { createHash } from "node:crypto";

export const SEMANTIC_DOCUMENT_VERSION = "semdoc-v1";

export type SemanticDocumentInput = {
  title: string;
  providerName: string;
  categoryNames: string[];
  topicTagNames: string[];
  level: string;
  durationMinutes: number | null;
  language: string | null;
  priceType: string;
  certificateType: string;
  freeDurability: string;
  /** AI-derived; only included when embedAiDerived is true. */
  summaryVi?: string | null;
  whyLearn?: string | null;
  embedAiDerived?: boolean;
};

export type BuiltSemanticDocument = {
  text: string;
  version: string;
  contentHash: string;
  usedAiDerived: boolean;
};

/**
 * Builds the text that gets embedded. Never includes raw HTML, scores, or
 * internal evidence (plan §88.2).
 */
export function buildSemanticDocument(
  input: SemanticDocumentInput,
): BuiltSemanticDocument {
  const parts: string[] = [
    `Title: ${input.title}`,
    `Provider: ${input.providerName}`,
  ];

  if (input.categoryNames.length > 0) {
    parts.push(`Categories: ${input.categoryNames.join(", ")}`);
  }
  if (input.topicTagNames.length > 0) {
    parts.push(`Topics: ${input.topicTagNames.join(", ")}`);
  }

  parts.push(`Level: ${input.level}`);
  if (input.durationMinutes != null) {
    parts.push(`DurationMinutes: ${input.durationMinutes}`);
  }
  if (input.language) {
    parts.push(`Language: ${input.language}`);
  }
  parts.push(`PriceType: ${input.priceType}`);
  parts.push(`CertificateType: ${input.certificateType}`);
  parts.push(`FreeDurability: ${input.freeDurability}`);

  let usedAiDerived = false;
  if (input.embedAiDerived) {
    if (input.summaryVi?.trim()) {
      parts.push(`Summary: ${input.summaryVi.trim()}`);
      usedAiDerived = true;
    }
    if (input.whyLearn?.trim()) {
      parts.push(`WhyLearn: ${input.whyLearn.trim()}`);
      usedAiDerived = true;
    }
  }

  const text = parts.join("\n");
  const contentHash = createHash("sha256").update(text).digest("hex");

  return {
    text,
    version: SEMANTIC_DOCUMENT_VERSION,
    contentHash,
    usedAiDerived,
  };
}
