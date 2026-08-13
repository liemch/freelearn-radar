import type { CertificateType } from "@/domain/course/types";

export type CertificateClassification = {
  certificateType: CertificateType;
  confidence: number;
  rationale: string;
  matchedSignals: string[];
};

function includesAny(text: string, patterns: RegExp[]): string[] {
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

/**
 * Conservative certificate classifier.
 * "Certificate available" / "Get certificate" alone is NOT FREE_CERTIFICATE.
 */
export function classifyCertificateFromText(
  raw: string,
): CertificateClassification {
  const text = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (!text) {
    return {
      certificateType: "UNKNOWN",
      confidence: 0,
      rationale: "Empty evidence text",
      matchedSignals: [],
    };
  }

  const freeCert = includesAny(text, [
    /\bfree certificate\b/,
    /\bcertificate is free\b/,
    /\bfree verified certificate\b/,
    /\bno cost certificate\b/,
    /\bcertificate included free\b/,
  ]);

  const paidCert = includesAny(text, [
    /\bpaid certificate\b/,
    /\bbuy (a )?certificate\b/,
    /\bpurchase (a )?certificate\b/,
    /\bcertificate fee\b/,
    /\bpay for (a )?certificate\b/,
    /\bverified certificate\b.*\b\$/,
  ]);

  const noCert = includesAny(text, [
    /\bno certificate\b/,
    /\bdoes not offer (a )?certificate\b/,
    /\bcertificate not available\b/,
  ]);

  const weakMention = includesAny(text, [
    /\bcertificate available\b/,
    /\bget (your )?certificate\b/,
    /\bearn a certificate\b/,
    /\bcertificate of completion\b/,
  ]);

  if (freeCert.length > 0 && paidCert.length === 0) {
    return {
      certificateType: "FREE_CERTIFICATE",
      confidence: 0.8,
      rationale: "Explicit free certificate language",
      matchedSignals: freeCert,
    };
  }

  if (paidCert.length > 0) {
    return {
      certificateType: "PAID_CERTIFICATE",
      confidence: 0.8,
      rationale: "Explicit paid certificate language",
      matchedSignals: paidCert,
    };
  }

  if (noCert.length > 0) {
    return {
      certificateType: "NO_CERTIFICATE",
      confidence: 0.75,
      rationale: "Explicit no-certificate language",
      matchedSignals: noCert,
    };
  }

  if (weakMention.length > 0) {
    return {
      certificateType: "UNKNOWN",
      confidence: 0.35,
      rationale:
        "Certificate mentioned without free/paid clarity — prefer UNKNOWN",
      matchedSignals: weakMention,
    };
  }

  return {
    certificateType: "UNKNOWN",
    confidence: 0.2,
    rationale: "Insufficient certificate evidence",
    matchedSignals: [],
  };
}

/**
 * Project plan §13: certificate status must not be inferred without evidence.
 * A weak mention ("earn a certificate") is a deliberate refusal, not a gap, so AI
 * cannot upgrade it. AI may only speak when the text carried no certificate signal at all.
 */
export function resolveCertificateType(input: {
  evidenceText: string;
  aiSuggestion?: CertificateType | null;
  aiConfidence?: number | null;
}): CertificateClassification {
  const deterministic = classifyCertificateFromText(input.evidenceText);

  if (deterministic.confidence >= 0.7) {
    return deterministic;
  }

  const ai = input.aiSuggestion;
  const aiConf = input.aiConfidence ?? 0;

  if (
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.7 &&
    deterministic.certificateType === "UNKNOWN" &&
    deterministic.matchedSignals.length > 0
  ) {
    return {
      ...deterministic,
      rationale: `${deterministic.rationale} (AI suggested ${ai}; rejected because deterministic evidence already refused this classification)`,
    };
  }

  if (
    ai &&
    ai !== "UNKNOWN" &&
    aiConf >= 0.7 &&
    deterministic.certificateType === "UNKNOWN"
  ) {
    return {
      certificateType: ai,
      confidence: Math.min(aiConf, 0.65),
      rationale: `Weak text evidence; adopting AI suggestion ${ai} at capped confidence`,
      matchedSignals: deterministic.matchedSignals,
    };
  }

  return deterministic;
}
