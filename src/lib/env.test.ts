import { describe, expect, it } from "vitest";

import { getServerEnv, resetServerEnvCache } from "@/lib/env";

describe("getServerEnv", () => {
  it("parses required and optional environment variables", () => {
    resetServerEnvCache();
    process.env.DATABASE_URL =
      "postgresql://user:password@localhost:5432/freelearn_radar_test";
    process.env.APP_URL = "http://localhost:3000";
    process.env.DISCOVERY_QUERY_LIMIT = "20";

    const env = getServerEnv();

    expect(env.DATABASE_URL).toContain("freelearn_radar_test");
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.DISCOVERY_QUERY_LIMIT).toBe(20);
    expect(env.TAVILY_API_KEY).toBe("");
  });

  it("throws when DATABASE_URL is missing", () => {
    resetServerEnvCache();
    delete process.env.DATABASE_URL;

    expect(() => getServerEnv()).toThrow(/DATABASE_URL/);
  });
});
