import { afterEach, describe, expect, it, vi } from "vitest";

import { TechhubSupabaseClient } from "@/services/techhub/supabase-client";

describe("TechhubSupabaseClient.updatePostsUltra", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates selected posts through the protected RPC without timestamps", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/rpc/admin_set_post_ultra")) {
        return Promise.resolve(new Response("true", { status: 200 }));
      }
      const techhubId = Number(new URL(url).searchParams.get("techhub_id")?.slice(3));
      return Promise.resolve(
        Response.json([{ id: techhubId, techhub_id: techhubId, is_ultra: true }]),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new TechhubSupabaseClient({
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      adminPasscode: "admin-test-passcode",
      usersTable: "users",
    });

    await client.updatePostsUltra([4027, 4028], true);

    const rpcCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/rpc/admin_set_post_ultra"),
    );
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls.map(([, options]) => JSON.parse(String(options.body)))).toEqual([
      {
        p_techhub_id: 4027,
        p_is_ultra: true,
        p_passcode: "admin-test-passcode",
      },
      {
        p_techhub_id: 4028,
        p_is_ultra: true,
        p_passcode: "admin-test-passcode",
      },
    ]);
    expect(rpcCalls.every(([, options]) => options.method === "POST")).toBe(true);
    expect(rpcCalls.every(([, options]) => !String(options.body).includes("_at"))).toBe(true);
  });
});
