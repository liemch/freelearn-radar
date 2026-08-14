import { describe, expect, it } from "vitest";

import {
  assertCertificateResolved,
  assertPriceTypeAllowed,
  resolveCertificateWithPolicy,
  SEED_PROVIDER_POLICIES,
} from "@/domain/verification/provider-policy";

describe("SEED_PROVIDER_POLICIES", () => {
  it("encodes Udemy free-tier and coupon rules", () => {
    const freeFull = SEED_PROVIDER_POLICIES.find(
      (p) => p.providerSlug === "udemy" && p.priceType === "FREE_FULL",
    );
    const coupon = SEED_PROVIDER_POLICIES.find(
      (p) => p.providerSlug === "udemy" && p.priceType === "FREE_WITH_COUPON",
    );

    expect(freeFull?.certificateType).toBe("NO_CERTIFICATE");
    expect(freeFull?.evidenceUrl).toContain("360040701614");
    expect(coupon?.certificateType).toBe("FREE_CERTIFICATE");
    expect(coupon?.evidenceUrl).toContain("1500010482202");
  });
});

describe("resolveCertificateWithPolicy", () => {
  it("applies Udemy FREE_FULL → NO_CERTIFICATE via policy", () => {
    const result = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_FULL",
      evidenceText: "Earn a certificate of completion",
      aiSuggestion: "FREE_CERTIFICATE",
      aiConfidence: 0.99,
    });
    expect(result.certificateType).toBe("NO_CERTIFICATE");
    expect(result.matchedSignals).toContain("provider_policy");
  });

  it("applies Udemy FREE_WITH_COUPON → FREE_CERTIFICATE via policy", () => {
    const result = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_WITH_COUPON",
      evidenceText: "",
    });
    expect(result.certificateType).toBe("FREE_CERTIFICATE");
  });

  it("applies microsoft-learn and freecodecamp FREE_FULL policies", () => {
    expect(
      resolveCertificateWithPolicy({
        providerSlug: "microsoft-learn",
        priceType: "FREE_FULL",
        evidenceText: "",
      }).certificateType,
    ).toBe("NO_CERTIFICATE");

    expect(
      resolveCertificateWithPolicy({
        providerSlug: "freecodecamp",
        priceType: "FREE_FULL",
        evidenceText: "",
      }).certificateType,
    ).toBe("FREE_CERTIFICATE");
  });

  it("prefers provider policy over page evidence and AI", () => {
    const result = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_FULL",
      evidenceText: "Free certificate included with this course",
      aiSuggestion: "FREE_CERTIFICATE",
      aiConfidence: 0.99,
    });
    expect(result.certificateType).toBe("NO_CERTIFICATE");
  });

  it("uses page evidence when no policy matches", () => {
    const result = resolveCertificateWithPolicy({
      providerSlug: "coursera",
      priceType: "FREE_AUDIT",
      evidenceText: "Buy a certificate for $49",
      aiSuggestion: "FREE_CERTIFICATE",
      aiConfidence: 0.99,
    });
    expect(result.certificateType).toBe("PAID_CERTIFICATE");
  });

  it("uses AI only when confidence ≥ 0.8 and no stronger signal", () => {
    const accepted = resolveCertificateWithPolicy({
      providerSlug: "unknown-provider",
      priceType: "FREE_FULL",
      evidenceText: "Some course marketing copy without cert language",
      aiSuggestion: "NO_CERTIFICATE",
      aiConfidence: 0.85,
    });
    expect(accepted.certificateType).toBe("NO_CERTIFICATE");

    const rejected = resolveCertificateWithPolicy({
      providerSlug: "unknown-provider",
      priceType: "FREE_FULL",
      evidenceText: "Some course marketing copy without cert language",
      aiSuggestion: "NO_CERTIFICATE",
      aiConfidence: 0.79,
    });
    expect(rejected.certificateType).toBe("UNKNOWN");
  });

  it("does not let AI override weak certificate refusal evidence", () => {
    const result = resolveCertificateWithPolicy({
      providerSlug: "unknown-provider",
      priceType: "FREE_FULL",
      evidenceText: "Earn a certificate of completion",
      aiSuggestion: "FREE_CERTIFICATE",
      aiConfidence: 0.99,
    });
    expect(result.certificateType).toBe("UNKNOWN");
    expect(result.rationale).toContain("rejected");
  });
});

describe("assertPriceTypeAllowed", () => {
  it("allows FREE_WITH_COUPON only from MANUAL", () => {
    expect(() =>
      assertPriceTypeAllowed("MANUAL", "FREE_WITH_COUPON"),
    ).not.toThrow();
    expect(() => assertPriceTypeAllowed("AI", "FREE_WITH_COUPON")).toThrow(
      /FREE_WITH_COUPON/,
    );
    expect(() => assertPriceTypeAllowed("SEARCH", "FREE_WITH_COUPON")).toThrow(
      /FREE_WITH_COUPON/,
    );
    expect(() => assertPriceTypeAllowed("POLICY", "FREE_WITH_COUPON")).toThrow(
      /FREE_WITH_COUPON/,
    );
  });

  it("allows other price types from any source", () => {
    expect(() => assertPriceTypeAllowed("AI", "FREE_FULL")).not.toThrow();
    expect(() => assertPriceTypeAllowed("SEARCH", "FREE_TRIAL")).not.toThrow();
  });
});

describe("database-backed policies (§66.2)", () => {
  const evidenceText = "Enroll now. Certificate details are not stated here.";

  it("lets a DB policy govern instead of the hardcoded seed set", () => {
    // Seed says udemy + FREE_FULL → NO_CERTIFICATE. An operator editing the
    // provider_policies row must be able to change that outcome.
    const resolved = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_FULL",
      evidenceText,
      policies: [
        {
          providerSlug: "udemy",
          priceType: "FREE_FULL",
          certificateType: "FREE_CERTIFICATE",
          active: true,
        },
      ],
    });

    expect(resolved.certificateType).toBe("FREE_CERTIFICATE");
    expect(resolved.matchedSignals).toContain("provider_policy");
  });

  it("ignores a policy whose effective_from is in the future", () => {
    const resolved = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_FULL",
      evidenceText,
      now: new Date("2026-01-01T00:00:00Z"),
      policies: [
        {
          providerSlug: "udemy",
          priceType: "FREE_FULL",
          certificateType: "FREE_CERTIFICATE",
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
          active: true,
        },
      ],
    });

    expect(resolved.matchedSignals).not.toContain("provider_policy");
  });

  it("applies a policy once its effective_from has passed", () => {
    const resolved = resolveCertificateWithPolicy({
      providerSlug: "udemy",
      priceType: "FREE_FULL",
      evidenceText,
      now: new Date("2026-07-01T00:00:00Z"),
      policies: [
        {
          providerSlug: "udemy",
          priceType: "FREE_FULL",
          certificateType: "FREE_CERTIFICATE",
          effectiveFrom: new Date("2026-06-01T00:00:00Z"),
          active: true,
        },
      ],
    });

    expect(resolved.certificateType).toBe("FREE_CERTIFICATE");
  });

  it("resolves the audit certificate for Coursera and edX from seed policy", () => {
    for (const slug of ["coursera", "edx"]) {
      const resolved = resolveCertificateWithPolicy({
        providerSlug: slug,
        priceType: "FREE_AUDIT",
        evidenceText,
      });

      expect(resolved.certificateType).toBe("PAID_CERTIFICATE");
    }
  });
});

describe("assertCertificateResolved", () => {
  it("rejects FREE_AUDIT paired with an UNKNOWN certificate", () => {
    expect(() => assertCertificateResolved("FREE_AUDIT", "UNKNOWN")).toThrow(
      /FREE_AUDIT/,
    );
  });

  it("accepts FREE_AUDIT once the certificate is known", () => {
    expect(() =>
      assertCertificateResolved("FREE_AUDIT", "PAID_CERTIFICATE"),
    ).not.toThrow();
  });

  it("leaves other price types alone", () => {
    expect(() => assertCertificateResolved("FREE_FULL", "UNKNOWN")).not.toThrow();
  });
});
