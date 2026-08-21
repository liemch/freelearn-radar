import { beforeEach, describe, expect, it, vi } from "vitest";

const insertApiUsage = vi.fn();

vi.mock("@/db/repositories/api-usage-repository", () => ({
  insertApiUsage: (...args: unknown[]) => insertApiUsage(...args),
  summarizeApiUsage: vi.fn(),
}));

import { measureApiUsage, recordApiUsage } from "@/domain/admin/api-usage";

import type { Db } from "@/db";

const db = {} as Db;

beforeEach(() => {
  insertApiUsage.mockReset();
  insertApiUsage.mockResolvedValue(undefined);
});

describe("recordApiUsage", () => {
  it("defaults units to one call and truncates long errors", async () => {
    await recordApiUsage(db, {
      kind: "search",
      provider: "tavily",
      ok: false,
      error: "x".repeat(900),
    });

    const [, row] = insertApiUsage.mock.calls[0] as [Db, Record<string, unknown>];
    expect(row.units).toBe(1);
    expect(String(row.error)).toHaveLength(500);
  });

  it("never throws when the log insert fails", async () => {
    insertApiUsage.mockRejectedValue(new Error("table missing"));

    await expect(
      recordApiUsage(db, { kind: "email", ok: true }),
    ).resolves.toBeUndefined();
  });
});

describe("measureApiUsage", () => {
  it("records a successful call and merges observed metadata", async () => {
    const result = await measureApiUsage(
      db,
      {
        kind: "search",
        provider: "tavily",
        operation: "discovery_search",
        meta: { discoveryQueryId: "q-1" },
      },
      async () => ["a", "b"],
      (found) => ({ meta: { resultCount: found.length } }),
    );

    expect(result).toEqual(["a", "b"]);
    const [, row] = insertApiUsage.mock.calls[0] as [Db, Record<string, unknown>];
    expect(row.ok).toBe(true);
    expect(row.metaJson).toEqual({ discoveryQueryId: "q-1", resultCount: 2 });
    expect(typeof row.latencyMs).toBe("number");
  });

  it("records the failure and rethrows so caller error handling is unchanged", async () => {
    await expect(
      measureApiUsage(db, { kind: "ai_analysis" }, async () => {
        throw new Error("upstream 500");
      }),
    ).rejects.toThrow("upstream 500");

    const [, row] = insertApiUsage.mock.calls[0] as [Db, Record<string, unknown>];
    expect(row.ok).toBe(false);
    expect(row.error).toBe("upstream 500");
  });
});
