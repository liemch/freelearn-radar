import { describe, expect, it } from "vitest";

import { searchThresholds } from "@/config/search-thresholds";
import { buildLearningPath } from "@/domain/search/learning-path";

describe("buildLearningPath", () => {
  it("builds 3-7 steps for a topic goal", () => {
    const path = buildLearningPath("learn python");
    expect(path).not.toBeNull();
    expect(path!.topicSlug).toBe("python");
    expect(path!.steps.length).toBeGreaterThanOrEqual(
      searchThresholds.learningPathStepsMin,
    );
    expect(path!.steps.length).toBeLessThanOrEqual(
      searchThresholds.learningPathStepsMax,
    );
    for (const step of path!.steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.query.length).toBeGreaterThan(0);
      expect(step.topicSlug).toBe("python");
      expect(step.courseIds).toEqual([]);
    }
  });

  it("progresses from fundamentals to a project", () => {
    const path = buildLearningPath("machine learning");
    expect(path!.steps[0]!.query).toContain("beginner");
    expect(path!.steps.at(-1)!.query).toContain("project");
  });

  it("adds a certificate step when the goal asks for one", () => {
    const withCert = buildLearningPath("python with certificate");
    const withoutCert = buildLearningPath("python");
    expect(withCert!.steps.length).toBe(withoutCert!.steps.length + 1);
    expect(withCert!.steps.at(-1)!.query).toContain("certificate");
  });

  it("falls back to the raw goal when no topic matches", () => {
    const path = buildLearningPath("digital marketing");
    expect(path).not.toBeNull();
    expect(path!.topicSlug).toBeNull();
    expect(path!.steps[0]!.query).toContain("digital marketing");
    expect(path!.steps[0]!.topicSlug).toBeUndefined();
  });

  it("returns null for an empty goal", () => {
    expect(buildLearningPath("")).toBeNull();
    expect(buildLearningPath("   ")).toBeNull();
  });

  it("is deterministic", () => {
    expect(buildLearningPath("learn ai")).toEqual(buildLearningPath("learn ai"));
  });
});
