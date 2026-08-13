import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP13 requires tests for unauthorized admin access and cron authentication.
 * These execute the real Next.js route handlers rather than the helpers behind them.
 */

const cookieValue = { current: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "flr_session" && cookieValue.current
        ? { name, value: cookieValue.current }
        : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const getDb = vi.fn(() => {
  throw new Error("Database must not be touched on a rejected request");
});

vi.mock("@/db", () => ({
  getDb: () => getDb(),
}));

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/test";
process.env.AUTH_SECRET = "route-security-test-secret-value-over-32-chars";
process.env.CRON_SECRET = "cron-secret-value-1234567890";
process.env.APP_URL = "http://localhost:3000";
process.env.TAVILY_API_KEY = "";

async function sessionCookieFor(role: "ADMIN" | "EDITOR") {
  const { resetServerEnvCache } = await import("@/lib/env");
  resetServerEnvCache();
  const { createSessionToken } = await import("@/lib/auth/session");
  return createSessionToken({
    userId: "00000000-0000-0000-0000-000000000001",
    email: `${role.toLowerCase()}@example.com`,
    role,
  });
}

function jsonRequest(url: string, body: unknown = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  cookieValue.current = undefined;
  getDb.mockClear();
  const { resetServerEnvCache } = await import("@/lib/env");
  resetServerEnvCache();
});

describe("admin API authentication", () => {
  it("rejects an anonymous candidate approval with 401", async () => {
    const { POST } = await import("@/app/api/admin/candidates/[id]/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/candidates/abc", {
        action: "approve",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects an anonymous discovery run with 401", async () => {
    const { POST } = await import("@/app/api/admin/discovery/run/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/discovery/run"),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects an anonymous course create with 401", async () => {
    const { POST } = await import("@/app/api/admin/courses/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/courses", {}),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects an anonymous status change with 401", async () => {
    const { POST } = await import("@/app/api/admin/courses/[id]/status/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/courses/abc/status", {
        status: "PUBLISHED",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("admin API authorization", () => {
  it("forbids EDITOR from approving candidates (ADMIN only)", async () => {
    cookieValue.current = await sessionCookieFor("EDITOR");

    const { POST } = await import("@/app/api/admin/candidates/[id]/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/candidates/abc", {
        action: "approve",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(response.status).toBe(403);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("forbids EDITOR from running discovery (ADMIN only)", async () => {
    cookieValue.current = await sessionCookieFor("EDITOR");

    const { POST } = await import("@/app/api/admin/discovery/run/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/discovery/run"),
    );

    expect(response.status).toBe(403);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects a forged session cookie", async () => {
    cookieValue.current = "not.a.valid.jwt";

    const { POST } = await import("@/app/api/admin/candidates/[id]/route");

    const response = await POST(
      jsonRequest("http://localhost:3000/api/admin/candidates/abc", {
        action: "approve",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );

    expect(response.status).toBe(401);
  });
});

describe("cron authentication", () => {
  it("rejects /api/cron/discover without a secret", async () => {
    const { GET } = await import("@/app/api/cron/discover/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/discover"),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("rejects /api/cron/discover with the wrong secret", async () => {
    const { GET } = await import("@/app/api/cron/discover/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/discover", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects /api/cron/verify without a secret", async () => {
    const { GET } = await import("@/app/api/cron/verify/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/verify"),
    );

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("accepts the Vercel bearer secret and then fails closed on missing search config", async () => {
    const { GET } = await import("@/app/api/cron/discover/route");

    const response = await GET(
      new Request("http://localhost:3000/api/cron/discover", {
        headers: { authorization: "Bearer cron-secret-value-1234567890" },
      }),
    );

    // Authenticated, but TAVILY_API_KEY is unset — must fail safely, not proceed.
    expect(response.status).toBe(503);
    expect(getDb).not.toHaveBeenCalled();
  });
});
