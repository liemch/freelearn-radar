import { describe, expect, it } from "vitest";

import {
  formatLevelLabel,
  getCertificateTypeLabel,
  getCourseStatusLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";

describe("course labels", () => {
  it("maps free full pricing to readable labels without enum leakage", () => {
    expect(getPriceTypeLabel("FREE_FULL")).toEqual({
      label: "100% Free",
      shortHint: "Full course access at no cost",
    });
    expect(getPriceTypeLabel("UNKNOWN").label).toBe("Status Unknown");
  });

  it("maps certificate and status types to readable labels", () => {
    expect(getCertificateTypeLabel("FREE_CERTIFICATE")).toBe(
      "Free certificate",
    );
    expect(getCertificateTypeLabel("PAID_CERTIFICATE")).toBe(
      "Paid certificate",
    );
    expect(getCourseStatusLabel("PUBLISHED")).toBe("Published");
    expect(formatLevelLabel("ALL_LEVELS")).toBe("All Levels");
  });
});
