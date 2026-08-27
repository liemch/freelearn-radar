import { afterEach, describe, expect, it, vi } from "vitest";

import { TechhubSupabaseClient } from "@/services/techhub/supabase-client";

describe("TechhubSupabaseClient.updatePostsUltra", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates only is_ultra for the selected post IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 1,
            techhub_id: 4027,
            is_ultra: true,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new TechhubSupabaseClient({
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      usersTable: "users",
    });

    await client.updatePostsUltra([4027, 4028], true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("techhub_id=in.(4027,4028)");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(String(options.body))).toEqual({ is_ultra: true });
  });
});
