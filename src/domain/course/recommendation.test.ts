import { describe, expect, it } from "vitest";

import {
  formatDuration,
  getRecommendationLabel,
} from "@/domain/course/recommendation";

describe("recommendation labels", () => {
  it("maps quality scores to public labels", () => {
    expect(getRecommendationLabel(90)).toBe("Highly Recommended");
    expect(getRecommendationLabel(75)).toBe("Recommended");
    expect(getRecommendationLabel(50)).toBe("Worth Exploring");
    expect(getRecommendationLabel(null)).toBe("Worth Exploring");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(90)).toBe("1.5 hours");
    expect(formatDuration(null)).toBeNull();
  });
});
