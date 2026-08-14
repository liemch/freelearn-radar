import { describe, expect, it } from "vitest";

import { classifyUrlShape } from "@/domain/discovery/url-shape-classifier";

describe("classifyUrlShape", () => {
  it("rejects Microsoft Learn Q&A / answers URLs", () => {
    const result = classifyUrlShape(
      "https://learn.microsoft.com/en-us/answers/questions/5569357/azure-ai-fundamentals-learning-path-coupon-code-in",
    );
    expect(result.class).toBe("KNOWN_NON_COURSE");
    expect(result.providerSlug).toBe("microsoft-learn");
  });

  it("accepts Microsoft Learn training paths", () => {
    const result = classifyUrlShape(
      "https://learn.microsoft.com/en-us/training/paths/ai-education",
    );
    expect(result.class).toBe("COURSE");
  });

  it("accepts Coursera learn URLs and rejects articles", () => {
    expect(
      classifyUrlShape("https://www.coursera.org/learn/python").class,
    ).toBe("COURSE");
    expect(
      classifyUrlShape("https://www.coursera.org/articles/what-is-ai").class,
    ).toBe("KNOWN_NON_COURSE");
  });

  it("accepts Udemy course URLs and rejects topic pages", () => {
    expect(classifyUrlShape("https://www.udemy.com/course/python/").class).toBe(
      "COURSE",
    );
    expect(classifyUrlShape("https://www.udemy.com/topic/python/").class).toBe(
      "KNOWN_NON_COURSE",
    );
  });

  it("does not over-block unknown shapes on known hosts", () => {
    const result = classifyUrlShape(
      "https://learn.microsoft.com/en-us/something-new/experimental",
    );
    expect(result.class).toBe("UNKNOWN");
  });

  it("leaves unknown hosts as UNKNOWN", () => {
    expect(classifyUrlShape("https://example.com/learn/foo").class).toBe(
      "UNKNOWN",
    );
  });
});
