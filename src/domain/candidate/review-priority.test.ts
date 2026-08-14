import { describe, expect, it } from "vitest";

import type { CourseCandidate } from "@/db/schema";
import {
  scoreCandidateForReview,
  sortCandidatesForReview,
} from "@/domain/candidate/review-priority";

function candidate(
  overrides: Partial<CourseCandidate> = {},
): CourseCandidate {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    sourceType: "SEARCH",
    searchQuery: null,
    sourceUrl: "https://example.com/course",
    canonicalUrl: "https://example.com/course",
    rawTitle: "Example",
    rawDescription: null,
    rawContent: null,
    provider: null,
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

describe("scoreCandidateForReview", () => {
  it("boosts high-tier providers and FREE_FULL price hints", () => {
    const high = scoreCandidateForReview(
      candidate({
        provider: "coursera",
        discoveryStatus: "READY_FOR_REVIEW",
        confidence: "0.9",
        aiAnalysisJson: { price_type: "FREE_FULL" },
      }),
    );
    const low = scoreCandidateForReview(
      candidate({
        provider: "unknown-site",
        discoveryStatus: "ANALYZED",
        confidence: "0.2",
        aiAnalysisJson: { price_type: "PAID" },
      }),
    );
    expect(high).toBeGreaterThan(low);
  });

  it("applies ERROR penalty and READY_FOR_REVIEW boost", () => {
    const ready = scoreCandidateForReview(
      candidate({ discoveryStatus: "READY_FOR_REVIEW" }),
    );
    const error = scoreCandidateForReview(
      candidate({ discoveryStatus: "ERROR" }),
    );
    expect(ready).toBeGreaterThan(error);
  });
});

describe("sortCandidatesForReview", () => {
  it("orders highest score first", () => {
    const list = [
      candidate({
        id: "low",
        provider: "other",
        confidence: "0.1",
      }),
      candidate({
        id: "high",
        provider: "microsoft-learn",
        discoveryStatus: "READY_FOR_REVIEW",
        confidence: "0.95",
        aiAnalysisJson: { price_type: "FREE_FULL" },
      }),
    ];
    const sorted = sortCandidatesForReview(list);
    expect(sorted.map((c) => c.id)).toEqual(["high", "low"]);
  });
});
