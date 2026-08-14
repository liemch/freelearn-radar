import { describe, expect, it } from "vitest";

import {
  classifyAccessFromText,
  getAccessBadgeLabelVi,
  isDailyFreeEligibleAccess,
  isPreviewOrTrialOnly,
} from "@/domain/access/access-classifier";

describe("classifyAccessFromText", () => {
  it("classifies Coursera audit separately from preview/trial", () => {
    expect(
      classifyAccessFromText({
        providerSlug: "coursera",
        text: "Audit for free. Certificate available for purchase.",
      }).access,
    ).toBe("FREE_AUDIT");

    expect(
      classifyAccessFromText({
        providerSlug: "coursera",
        text: "Free preview of the first module.",
      }).access,
    ).toBe("FREE_PREVIEW");

    expect(
      classifyAccessFromText({
        providerSlug: "coursera",
        text: "Start your free trial today.",
      }).access,
    ).toBe("FREE_TRIAL");
  });

  it("does not conflate FREE_PREVIEW with FREE_FULL", () => {
    const preview = classifyAccessFromText({
      providerSlug: "coursera",
      text: "Xem trước miễn phí một số bài giảng.",
    });
    expect(preview.access).toBe("FREE_PREVIEW");
    expect(isPreviewOrTrialOnly(preview.access)).toBe(true);
    expect(isDailyFreeEligibleAccess(preview.access)).toBe(false);
    expect(getAccessBadgeLabelVi(preview.access)).not.toMatch(/100%/);
  });
});
