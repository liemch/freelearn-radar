import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type {
  SearchInput,
  SearchProvider,
  SearchResult,
} from "@/services/search/search-provider";

type FetchLike = typeof fetch;

type TavilyResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesDomain(url: string, domains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return domains.some((domain) => {
      const normalized = domain.replace(/^www\./, "");
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

export class TavilySearchProvider implements SearchProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(options?: { apiKey?: string; fetchImpl?: FetchLike }) {
    this.apiKey = options?.apiKey ?? getServerEnv().TAVILY_API_KEY;
    this.fetchImpl = options?.fetchImpl ?? fetch;

    if (!this.apiKey) {
      throw new Error("TAVILY_API_KEY is required");
    }
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    const maxResults = Math.max(1, Math.min(input.maxResults ?? 5, 10));
    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchImpl("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            query: input.query,
            max_results: maxResults,
            include_domains: input.includeDomains,
            search_depth: "basic",
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Tavily request failed (${response.status}): ${body}`);
        }

        const payload = (await response.json()) as TavilyResponse;
        const results = (payload.results ?? [])
          .filter((item) => typeof item.url === "string" && item.url.length > 0)
          .map((item) => ({
            title: item.title?.trim() || "Untitled",
            url: item.url!,
            content: item.content?.trim() || "",
            score: typeof item.score === "number" ? item.score : undefined,
          }))
          .filter((item) =>
            input.includeDomains && input.includeDomains.length > 0
              ? matchesDomain(item.url, input.includeDomains)
              : true,
          )
          .slice(0, maxResults);

        logger.info("search.tavily", {
          status: "success",
          query: input.query,
          resultCount: results.length,
          attempt,
        });

        return results;
      } catch (error) {
        lastError = error;
        const aborted =
          error instanceof Error &&
          (error.name === "AbortError" || error.message.includes("aborted"));

        logger.warn("search.tavily", {
          status: aborted ? "timeout" : "retry",
          query: input.query,
          attempt,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        if (attempt < MAX_RETRIES) {
          await sleep(250 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Tavily search failed");
  }
}

export function createSearchProvider(
  options?: { apiKey?: string; fetchImpl?: FetchLike },
): SearchProvider {
  return new TavilySearchProvider(options);
}
