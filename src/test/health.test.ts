import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@/db", () => ({
  getDb: () => ({ execute: (...args: unknown[]) => execute(...args) }),
}));

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
process.env.AUTH_SECRET = "health-test-auth-secret-value-over-32-characters";
process.env.APP_URL = "http://localhost:3000";

async function callHealth(url: string, headers?: HeadersInit) {
  const { resetServerEnvCache } = await import("@/lib/env");
  resetServerEnvCache();
  const { GET } = await import("@/app/api/health/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(url, { headers }));
}

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue(undefined);
  process.env.CRON_SECRET = "health-cron-secret-1234567890";
});

describe("health endpoint", () => {
  it("answers liveness without touching the database", async () => {
    const response = await callHealth("http://localhost:3000/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      service: "freelearn-radar",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated deep probe while a cron secret is configured", async () => {
    const response = await callHealth(
      "http://localhost:3000/api/health?deep=1",
    );

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs the deep probe for an authenticated caller", async () => {
    const response = await callHealth(
      "http://localhost:3000/api/health?deep=1",
      { authorization: "Bearer health-cron-secret-1234567890" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ database: "ok" });
  });

  it("reports degraded when the database probe fails", async () => {
    execute.mockRejectedValue(new Error("connection refused"));

    const response = await callHealth(
      "http://localhost:3000/api/health?deep=1",
      { "x-cron-secret": "health-cron-secret-1234567890" },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      database: "error",
    });
  });

  it("keeps the deep probe open when no cron secret is configured (local dev)", async () => {
    process.env.CRON_SECRET = "";

    const response = await callHealth(
      "http://localhost:3000/api/health?deep=1",
    );

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalled();
  });
});
