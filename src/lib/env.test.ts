import { beforeEach, describe, expect, it } from "vitest";

import { getServerEnv, resetServerEnvCache } from "@/lib/env";

describe("getServerEnv", () => {
  beforeEach(() => {
    resetServerEnvCache();
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
  });

  it("parses required and optional environment variables", () => {
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
    delete process.env.DATABASE_URL;
    expect(() => getServerEnv()).toThrow(/DATABASE_URL/);
  });

  it("requires AUTH_SECRET and CRON_SECRET in production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.DATABASE_URL =
      "postgresql://user:password@localhost:5432/freelearn_radar_test";
    process.env.AUTH_SECRET = "short";
    process.env.CRON_SECRET = "";

    expect(() => getServerEnv()).toThrow(/AUTH_SECRET/);
  });
});
