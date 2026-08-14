import { describe, expect, it } from "vitest";

import {
  buildSemanticDocument,
  SEMANTIC_DOCUMENT_VERSION,
  type SemanticDocumentInput,
} from "@/domain/embedding/semantic-document";

function makeInput(
  overrides?: Partial<SemanticDocumentInput>,
): SemanticDocumentInput {
  return {
    title: "Azure Fundamentals",
    providerName: "Microsoft Learn",
    categoryNames: ["Cloud"],
    topicTagNames: ["azure"],
    level: "BEGINNER",
    durationMinutes: 120,
    language: "English",
    priceType: "FREE_FULL",
    certificateType: "NO_CERTIFICATE",
    freeDurability: "PERMANENT",
    ...overrides,
  };
}

describe("buildSemanticDocument", () => {
  it("produces a stable hash for identical input", () => {
    const a = buildSemanticDocument(makeInput());
    const b = buildSemanticDocument(makeInput());
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.text).toBe(b.text);
    expect(a.version).toBe(SEMANTIC_DOCUMENT_VERSION);
  });

  it("changes the hash when any fact changes", () => {
    const base = buildSemanticDocument(makeInput());
    const changed = buildSemanticDocument(
      makeInput({ priceType: "FREE_AUDIT" }),
    );
    expect(changed.contentHash).not.toBe(base.contentHash);
  });

  it("omits optional facts when absent", () => {
    const doc = buildSemanticDocument(
      makeInput({
        categoryNames: [],
        topicTagNames: [],
        durationMinutes: null,
        language: null,
      }),
    );
    expect(doc.text).not.toContain("Categories:");
    expect(doc.text).not.toContain("Topics:");
    expect(doc.text).not.toContain("DurationMinutes:");
    expect(doc.text).not.toContain("Language:");
  });

  it("excludes AI-derived fields unless explicitly enabled", () => {
    const off = buildSemanticDocument(
      makeInput({ summaryVi: "tóm tắt", whyLearn: "lý do" }),
    );
    expect(off.usedAiDerived).toBe(false);
    expect(off.text).not.toContain("tóm tắt");

    const on = buildSemanticDocument(
      makeInput({
        summaryVi: "tóm tắt",
        whyLearn: "lý do",
        embedAiDerived: true,
      }),
    );
    expect(on.usedAiDerived).toBe(true);
    expect(on.text).toContain("Summary: tóm tắt");
    expect(on.text).toContain("WhyLearn: lý do");
  });

  it("ignores blank AI-derived fields even when enabled", () => {
    const doc = buildSemanticDocument(
      makeInput({ summaryVi: "   ", whyLearn: "", embedAiDerived: true }),
    );
    expect(doc.usedAiDerived).toBe(false);
    expect(doc.text).not.toContain("Summary:");
  });

  it("always includes the truth-critical facts", () => {
    const doc = buildSemanticDocument(makeInput());
    expect(doc.text).toContain("Title: Azure Fundamentals");
    expect(doc.text).toContain("Provider: Microsoft Learn");
    expect(doc.text).toContain("PriceType: FREE_FULL");
    expect(doc.text).toContain("CertificateType: NO_CERTIFICATE");
    expect(doc.text).toContain("FreeDurability: PERMANENT");
  });
});
