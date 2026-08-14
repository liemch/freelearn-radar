import { describe, expect, it } from "vitest";

import type { CourseCandidate } from "@/db/schema";
import {
  evaluateAutoReject,
  isAutoRejectedCandidate,
  AUTO_REJECT_PREFIX,
} from "@/domain/candidate/auto-reject";

function candidate(
  overrides: Partial<CourseCandidate> = {},
): CourseCandidate {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    sourceType: "SEARCH",
    searchQuery: null,
    sourceUrl: "https://www.coursera.org/learn/ml",
    canonicalUrl: "https://www.coursera.org/learn/ml",
    rawTitle: "Example",
    rawDescription: null,
    rawContent: null,
    provider: "coursera",
    discoveryStatus: "ANALYZED",
    aiAnalysisJson: null,
    confidence: null,
    discoveredAt: new Date("2026-01-01"),
    analyzedAt: null,
    approvedAt: null,
    rejectedAt: null,
    errorMessage: null,
    sourceEvidenceJson: null,
    sourceFetchedAt: null,
    sourceFinalUrl: null,
    sourceImageUrl: null,
    ...overrides,
  };
}

describe("evaluateAutoReject", () => {
  it("rejects KNOWN_NON_COURSE urls", () => {
    const decision = evaluateAutoReject(
      candidate({
        canonicalUrl: "https://www.coursera.org/articles/something",
        sourceUrl: "https://www.coursera.org/articles/something",
      }),
    );
    expect(decision.reject).toBe(true);
    expect(decision.rule).toMatch(/^KNOWN_NON_COURSE:/);
  });

  it("rejects is_course false with confidence >= 0.9", () => {
    const decision = evaluateAutoReject(
      candidate({
        aiAnalysisJson: { is_course: false, confidence: 0.95 },
      }),
    );
    expect(decision).toEqual({
      reject: true,
      rule: "AI_NOT_COURSE_HIGH_CONFIDENCE",
    });
  });

  it("does not reject is_course false with lower confidence", () => {
    const decision = evaluateAutoReject(
      candidate({
        aiAnalysisJson: { is_course: false, confidence: 0.5 },
      }),
    );
    expect(decision.reject).toBe(false);
  });

  it("does not reject normal course urls", () => {
    const decision = evaluateAutoReject(candidate());
    expect(decision.reject).toBe(false);
  });
});

describe("isAutoRejectedCandidate", () => {
  it("detects AUTO_REJECT prefix on REJECTED rows", () => {
    expect(
      isAutoRejectedCandidate(
        candidate({
          discoveryStatus: "REJECTED",
          errorMessage: `${AUTO_REJECT_PREFIX} KNOWN_NON_COURSE:x`,
        }),
      ),
    ).toBe(true);
    expect(
      isAutoRejectedCandidate(
        candidate({
          discoveryStatus: "REJECTED",
          errorMessage: "Rejected by admin",
        }),
      ),
    ).toBe(false);
  });
});
