import { describe, expect, it } from "vitest";

import { mapFetchResultToStatus } from "@/domain/monitor/observe-course";
import type { CourseSourceResult } from "@/services/fetch/course-source-fetcher";

const basePolicy = {
  fetch: "FETCH_ALLOWED" as const,
  image: "REMOTE_ONLY" as const,
  label: "test",
};

function result(
  partial: Partial<CourseSourceResult>,
): Pick<CourseSourceResult, "status" | "httpStatus" | "errors" | "policy"> {
  return {
    status: "error",
    httpStatus: null,
    errors: [],
    policy: basePolicy,
    ...partial,
  };
}

describe("observe-course fetch status mapping", () => {
  it("maps http 404 to NOT_FOUND", () => {
    expect(
      mapFetchResultToStatus(
        result({ status: "error", errors: ["http_404"], httpStatus: 404 }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("maps http 410 to NOT_FOUND", () => {
    expect(
      mapFetchResultToStatus(
        result({ status: "error", errors: ["http_410"], httpStatus: 410 }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("does not treat NOT_FOUND as OK for event eligibility", () => {
    const status = mapFetchResultToStatus(
      result({ status: "error", errors: ["http_404"], httpStatus: 404 }),
    );
    expect(status).not.toBe("OK");
    expect(status).toBe("NOT_FOUND");
  });
});
