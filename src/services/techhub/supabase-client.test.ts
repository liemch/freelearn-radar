import { afterEach, describe, expect, it, vi } from "vitest";

import { TechhubSupabaseClient } from "@/services/techhub/supabase-client";

describe("TechhubSupabaseClient.createCsocTestPosts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates inert csoc rows with created_at explicitly null", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (String(url).includes("/users?")) {
        return Promise.resolve(Response.json([{ id: 37 }]));
      }
      const rows = JSON.parse(String(options?.body));
      return Promise.resolve(Response.json(rows.map((row: object, index: number) => ({
        id: index + 1,
        ...row,
      }))));
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new TechhubSupabaseClient({
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      adminPasscode: "",
      usersTable: "users",
    });

    const posts = await client.createCsocTestPosts(2);
    expect(posts).toHaveLength(2);
    const [, options] = fetchMock.mock.calls[1];
    const rows = JSON.parse(String(options.body));
    expect(options.method).toBe("POST");
    expect(rows).toHaveLength(2);
    expect(rows.map((row: { title: string }) => row.title)).toEqual(Array(2).fill(
      "Team csoc đang kiểm tra: yêu cầu người dùng TechHub tắt ngay extension/bot tự động đang sử dụng để rà soát dấu hiệu vi phạm nội quy",
    ));
    expect(rows.every((row: Record<string, unknown>) =>
      row.username === "csoc" &&
      row.status === "test" &&
      row.is_blacklisted === true &&
      row.is_auto_reply_enabled === false &&
      row.is_ultra === false &&
      row.url === null &&
      row.created_at === null &&
      !Object.keys(row).some((key) => key.endsWith("_at") && key !== "created_at") &&
      String(row.title).includes("tắt ngay extension/bot tự động")
    )).toBe(true);
    expect(new Set(rows.map((row: { techhub_id: number }) => row.techhub_id)).size).toBe(2);
  });

  it("rejects quantities outside 1–20", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TechhubSupabaseClient({
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      adminPasscode: "",
      usersTable: "users",
    });

    await expect(client.createCsocTestPosts(21)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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

describe("TechhubSupabaseClient.deletePostByTechhubId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes the post, verifies removal, then cleans every related table", async () => {
    let postExists = true;
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      const method = options?.method ?? "GET";
      if (url.includes("/posts?") && method === "GET") {
        return Promise.resolve(
          Response.json(
            postExists
              ? [{ id: 1, techhub_id: 4027, title: "Post", username: "user" }]
              : [],
          ),
        );
      }
      if (url.includes("/posts?") && method === "DELETE") postExists = false;
      return Promise.resolve(Response.json([{ id: 1 }], { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new TechhubSupabaseClient({
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      adminPasscode: "admin-test-passcode",
      usersTable: "users",
    });

    const result = await client.deletePostByTechhubId(4027);

    expect(result.post?.techhub_id).toBe(4027);
    expect(result.deleted).toEqual({
      posts: 1,
      interactions: 1,
      user_post_discussions: 1,
      post_discussions: 1,
      posts_to_unvote: 1,
      posts_to_delete: 1,
    });
    const deleteUrls = fetchMock.mock.calls
      .filter(([, options]) => options?.method === "DELETE")
      .map(([url]) => String(url));
    expect(deleteUrls).toEqual([
      "https://example.supabase.co/rest/v1/posts?techhub_id=eq.4027",
      "https://example.supabase.co/rest/v1/interactions?techhub_id=eq.4027",
      "https://example.supabase.co/rest/v1/user_post_discussions?techhub_id=eq.4027",
      "https://example.supabase.co/rest/v1/post_discussions?techhub_id=eq.4027",
      "https://example.supabase.co/rest/v1/posts_to_unvote?techhub_id=eq.4027",
      "https://example.supabase.co/rest/v1/posts_to_delete?techhub_id=eq.4027",
    ]);
  });
});
