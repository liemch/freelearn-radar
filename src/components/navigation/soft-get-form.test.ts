import { describe, expect, it } from "vitest";

import { buildSoftGetHref } from "@/components/navigation/soft-get-form";

describe("buildSoftGetHref", () => {
  it("builds a shareable query URL and drops empty fields", () => {
    const formData = new FormData();
    formData.set("q", " python beginner ");
    formData.set("provider", "");
    formData.set("sort", "newest");

    expect(
      buildSoftGetHref("/vi/search", formData, "https://freelearn.example"),
    ).toBe("/vi/search?q=python+beginner&sort=newest");
  });

  it("replaces stale action query parameters", () => {
    const formData = new FormData();
    formData.set("level", "BEGINNER");

    expect(
      buildSoftGetHref(
        "/vi/search?page=4",
        formData,
        "https://freelearn.example",
      ),
    ).toBe("/vi/search?level=BEGINNER");
  });
});
