import { describe, expect, it } from "vitest";

import { courseFormSchema } from "@/domain/course/course-form";

describe("courseFormSchema", () => {
  it("accepts a valid course payload", () => {
    const parsed = courseFormSchema.parse({
      title: "Python Basics",
      slug: "python-basics",
      providerId: "550e8400-e29b-41d4-a716-446655440000",
      categoryIds: [],
      canonicalUrl: "https://example.com/course",
      level: "BEGINNER",
      priceType: "FREE_FULL",
      certificateType: "FREE_CERTIFICATE",
      status: "DRAFT",
    });

    expect(parsed.slug).toBe("python-basics");
    expect(parsed.status).toBe("DRAFT");
  });

  it("rejects invalid slugs", () => {
    const result = courseFormSchema.safeParse({
      title: "Python Basics",
      slug: "Python Basics",
      providerId: "550e8400-e29b-41d4-a716-446655440000",
      categoryIds: [],
      canonicalUrl: "https://example.com/course",
      level: "BEGINNER",
      priceType: "FREE_FULL",
      certificateType: "FREE_CERTIFICATE",
    });

    expect(result.success).toBe(false);
  });
});
