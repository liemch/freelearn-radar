import { describe, expect, it } from "vitest";

import {
  getCertificateTypeLabel,
  getPriceTypeLabel,
} from "@/domain/course/labels";

describe("course labels", () => {
  it("maps free full pricing to the public badge label", () => {
    expect(getPriceTypeLabel("FREE_FULL")).toEqual({
      label: "100% Free",
      badge: "🟢",
    });
  });

  it("maps certificate types to readable labels", () => {
    expect(getCertificateTypeLabel("PAID_CERTIFICATE")).toBe(
      "Certificate Paid",
    );
  });
});
