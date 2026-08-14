import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    FEATURE_COUPON_DISCOVERY: "true",
    SOURCE_FETCH_TIMEOUT_MS: 5000,
    SOURCE_MAX_REDIRECTS: 3,
    SOURCE_MAX_RESPONSE_BYTES: 1024,
    COUPON_VERIFY_CONCURRENCY: 2,
    COUPON_VERIFY_LIMIT: 10,
  }),
}));

import { evidenceFromOfficialFetch } from "@/domain/coupon/coupon-verification-runner";
import { resolveCouponVerificationStatus } from "@/domain/coupon/coupon-service";

describe("evidenceFromOfficialFetch", () => {
  it("maps failed fetch to UNKNOWN (never ACTIVE_100_OFF)", () => {
    const evidence = evidenceFromOfficialFetch({
      ok: false,
      reason: "network_error",
    });
    expect(evidence.officialFetchOk).toBe(false);
    expect(resolveCouponVerificationStatus(evidence)).toBe("UNKNOWN");
  });

  it("maps blocked responses to BLOCKED", () => {
    const evidence = evidenceFromOfficialFetch({
      ok: false,
      status: 403,
      reason: "forbidden",
    });
    expect(resolveCouponVerificationStatus(evidence)).toBe("BLOCKED");
  });

  it("requires official success before ACTIVE_100_OFF", () => {
    const evidence = evidenceFromOfficialFetch({
      ok: true,
      status: 200,
      body: "Get this course free with coupon — 100% off — $0",
    });
    expect(evidence.officialFetchOk).toBe(true);
    expect(resolveCouponVerificationStatus(evidence)).toBe("ACTIVE_100_OFF");
  });
});
