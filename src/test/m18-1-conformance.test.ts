import { describe, expect, it } from "vitest";

import { decideSampleCourseSeeding } from "@/db/seed/data";
import { resolveCertificateType } from "@/domain/verification/certificate-status";
import { resolvePriceType } from "@/domain/verification/free-status";
import { produceVerificationResult } from "@/domain/verification/verification-service";

/**
 * Regression tests for M18.1 conformance findings.
 * Each block names the finding it locks down.
 */

describe("P0-01 — sample courses must never be seeded into production", () => {
  it("refuses on a production runtime even with the opt-in flag set", () => {
    expect(
      decideSampleCourseSeeding({
        NODE_ENV: "production",
        SEED_SAMPLE_COURSES: "true",
      }).allowed,
    ).toBe(false);

    expect(
      decideSampleCourseSeeding({ VERCEL: "1", SEED_SAMPLE_COURSES: "true" })
        .allowed,
    ).toBe(false);

    expect(
      decideSampleCourseSeeding({
        VERCEL_ENV: "production",
        SEED_SAMPLE_COURSES: "true",
      }).allowed,
    ).toBe(false);
  });

  it("refuses locally unless explicitly opted in", () => {
    expect(decideSampleCourseSeeding({}).allowed).toBe(false);
    expect(
      decideSampleCourseSeeding({ SEED_SAMPLE_COURSES: "1" }).allowed,
    ).toBe(false);
  });

  it("allows an explicit local opt-in", () => {
    expect(
      decideSampleCourseSeeding({
        NODE_ENV: "development",
        SEED_SAMPLE_COURSES: "true",
      }).allowed,
    ).toBe(true);
  });
});

describe("P1-01 — AI cannot overturn a deterministic refusal", () => {
  it("keeps ambiguous marketing copy out of FREE_FULL", () => {
    const result = resolvePriceType({
      evidenceText: "Start learning for free today on our platform",
      aiSuggestion: "FREE_FULL",
      aiConfidence: 0.95,
    });

    expect(result.priceType).toBe("UNKNOWN");
    expect(result.rationale).toContain("rejected");
  });

  it("keeps a free preview out of FREE_FULL", () => {
    const result = resolvePriceType({
      evidenceText: "Watch the free preview lesson",
      aiSuggestion: "FREE_FULL",
      aiConfidence: 0.9,
    });

    expect(result.priceType).toBe("UNKNOWN");
  });

  it("keeps conflicting free/paid signals unresolved", () => {
    const result = resolvePriceType({
      evidenceText: "100% free course. Price: $49 to purchase.",
      aiSuggestion: "FREE_FULL",
      aiConfidence: 0.99,
    });

    expect(result.priceType).not.toBe("FREE_FULL");
  });

  it("still lets AI fill a genuine evidence gap", () => {
    const result = resolvePriceType({
      evidenceText: "Module 3 of the Azure series",
      aiSuggestion: "FREE_FULL",
      aiConfidence: 0.9,
    });

    expect(result.priceType).toBe("FREE_FULL");
    expect(result.confidence).toBeLessThanOrEqual(0.65);
  });

  it("does not let AI upgrade a vague certificate mention (plan §13)", () => {
    const result = resolveCertificateType({
      evidenceText: "Earn a certificate when you finish the course",
      aiSuggestion: "FREE_CERTIFICATE",
      aiConfidence: 0.95,
    });

    expect(result.certificateType).toBe("UNKNOWN");
  });

  it("still lets AI fill a genuine certificate gap", () => {
    const result = resolveCertificateType({
      evidenceText: "A short introduction to Python",
      aiSuggestion: "PAID_CERTIFICATE",
      aiConfidence: 0.9,
    });

    expect(result.certificateType).toBe("PAID_CERTIFICATE");
  });
});

describe("P1-02 — inconclusive rechecks must not look verified", () => {
  const course = {
    id: "c1",
    title: "Intro to Python",
    canonicalUrl: "https://coursera.org/learn/python",
    status: "PUBLISHED" as const,
    priceType: "FREE_AUDIT" as const,
    certificateType: "PAID_CERTIFICATE" as const,
    lastVerifiedAt: new Date("2026-01-01"),
    providerName: "Coursera",
    categoryCount: 1,
  };

  it("records FAILED and keeps the previous last_verified_at when evidence says nothing", () => {
    const result = produceVerificationResult(
      course,
      {
        // A search snippet that only echoes the title carries no pricing evidence.
        text: "Intro to Python",
        sourceUrl: course.canonicalUrl,
        method: "SEARCH",
        availability: "AVAILABLE",
      },
      new Date("2026-08-13"),
    );

    expect(result.status).toBe("FAILED");
    expect(result.refreshLastVerifiedAt).toBe(false);
    expect(result.updateCourse).toBe(false);
    expect(result.notes).toContain("last_verified_at not refreshed");
  });

  it("records VERIFIED and refreshes the clock when pricing evidence is usable", () => {
    const result = produceVerificationResult(
      course,
      {
        text: "Free to audit. Paid certificate available for $49.",
        sourceUrl: course.canonicalUrl,
        method: "SEARCH",
        availability: "AVAILABLE",
      },
      new Date("2026-08-13"),
    );

    expect(result.status).toBe("VERIFIED");
    expect(result.refreshLastVerifiedAt).toBe(true);
  });

  it("treats a definitive unavailable signal as conclusive", () => {
    const result = produceVerificationResult(
      course,
      {
        text: "This course is no longer offered",
        sourceUrl: course.canonicalUrl,
        method: "SEARCH",
        availability: "UNAVAILABLE",
      },
      new Date("2026-08-13"),
    );

    expect(result.refreshLastVerifiedAt).toBe(true);
    expect(result.nextCourseStatus).toBe("UNAVAILABLE");
  });
});
