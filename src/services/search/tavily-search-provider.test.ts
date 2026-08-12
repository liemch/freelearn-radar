import { describe, expect, it, vi } from "vitest";

import { TavilySearchProvider } from "@/services/search/tavily-search-provider";

describe("TavilySearchProvider", () => {
  it("maps and domain-filters search results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "Python Course",
            url: "https://www.coursera.org/learn/python",
            content: "Free to audit",
            score: 0.9,
          },
          {
            title: "Spam",
            url: "https://example.com/spam",
            content: "ignore",
          },
        ],
      }),
    });

    const provider = new TavilySearchProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const results = await provider.search({
      query: 'site:coursera.org python free',
      includeDomains: ["coursera.org"],
      maxResults: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.url).toContain("coursera.org");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries on timeout then fails", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const provider = new TavilySearchProvider({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      provider.search({ query: "timeout test", timeoutMs: 10 }),
    ).rejects.toThrow(/aborted|Tavily/i);

    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
  });

  it("requires an API key", () => {
    expect(
      () =>
        new TavilySearchProvider({
          apiKey: "",
        }),
    ).toThrow(/TAVILY_API_KEY/);
  });

  it.each([401, 429, 500])(
    "fails safely after retries on HTTP %s",
    async (status) => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: async () => `error-${status}`,
      });

      const provider = new TavilySearchProvider({
        apiKey: "test-key",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await expect(
        provider.search({ query: `status-${status}` }),
      ).rejects.toThrow(new RegExp(`Tavily request failed \\(${status}\\)`));

      expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
    },
  );
});
