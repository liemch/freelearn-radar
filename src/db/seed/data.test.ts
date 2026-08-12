import { describe, expect, it } from "vitest";

import {
  deriveAdminName,
  parseAdminEmails,
} from "@/db/seed/data";

describe("admin seed helpers", () => {
  it("parses comma-separated admin emails", () => {
    expect(parseAdminEmails(" Admin@Example.com,editor@test.com ")).toEqual([
      "admin@example.com",
      "editor@test.com",
    ]);
  });

  it("derives a readable admin name from email", () => {
    expect(deriveAdminName("admin@example.com")).toBe("Admin");
  });
});
