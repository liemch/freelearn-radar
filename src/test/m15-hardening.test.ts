import { describe, expect, it } from "vitest";

import {
  canApproveCandidate,
  canRejectCandidate,
  canTransitionCourseStatus,
} from "@/domain/course/transitions";
import { buildOutboundUrl } from "@/domain/ranking/ranking";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("lifecycle transitions", () => {
  it("only allows approving reviewable candidates", () => {
    expect(canApproveCandidate("READY_FOR_REVIEW")).toBe(true);
    expect(canApproveCandidate("ANALYZED")).toBe(true);
    expect(canApproveCandidate("DISCOVERED")).toBe(false);
    expect(canApproveCandidate("REJECTED")).toBe(false);
  });

  it("blocks rejecting already approved candidates", () => {
    expect(canRejectCandidate("READY_FOR_REVIEW")).toBe(true);
    expect(canRejectCandidate("APPROVED")).toBe(false);
  });

  it("enforces course status transitions", () => {
    expect(canTransitionCourseStatus("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionCourseStatus("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransitionCourseStatus("PUBLISHED", "ARCHIVED")).toBe(true);
  });
});

describe("outbound URL safety regression", () => {
  it("rejects unsafe affiliate URLs and falls back", () => {
    const url = buildOutboundUrl({
      affiliateUrl: "javascript:alert(1)",
      outboundUrl: "https://provider.example/course",
      canonicalUrl: "https://provider.example/course",
    });
    expect(url).toBe("https://provider.example/course");
  });

  it("throws when no safe URL exists", () => {
    expect(() =>
      buildOutboundUrl({
        affiliateUrl: "javascript:alert(1)",
        outboundUrl: "data:text/html,x",
        canonicalUrl: "file:///etc/passwd",
      }),
    ).toThrow(/No safe outbound URL/);
  });
});

describe("rate limit", () => {
  it("blocks after exceeding window", () => {
    resetRateLimits();
    expect(checkRateLimit("t", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("t", 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit("t", 2, 60_000).allowed).toBe(false);
  });
});
