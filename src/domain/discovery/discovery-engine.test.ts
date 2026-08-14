import { beforeEach, describe, expect, it, vi } from "vitest";

const createCandidate = vi.fn();
const findCandidateByCanonicalUrl = vi.fn();
const findCourseByCanonicalUrl = vi.fn();
const listDueDiscoveryQueries = vi.fn();
const markDiscoveryQuerySuccess = vi.fn();
const markDiscoveryQueryFailure = vi.fn();

vi.mock("@/db/repositories/candidate-repository", () => ({
  createCandidate: (...args: unknown[]) => createCandidate(...args),
  findCandidateByCanonicalUrl: (...args: unknown[]) =>
    findCandidateByCanonicalUrl(...args),
  updateCandidate: vi.fn(),
}));

vi.mock("@/db/repositories/course-repository", () => ({
  findCourseByCanonicalUrl: (...args: unknown[]) =>
    findCourseByCanonicalUrl(...args),
}));

vi.mock("@/domain/discovery/discovery-query-service", () => ({
  listDueDiscoveryQueries: (...args: unknown[]) =>
    listDueDiscoveryQueries(...args),
  markDiscoveryQuerySuccess: (...args: unknown[]) =>
    markDiscoveryQuerySuccess(...args),
  markDiscoveryQueryFailure: (...args: unknown[]) =>
    markDiscoveryQueryFailure(...args),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DISCOVERY_QUERY_LIMIT: 15,
    DISCOVERY_RESULT_LIMIT: 5,
    AI_ANALYSIS_LIMIT: 30,
    DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
    APP_URL: "http://localhost:3000",
    AUTH_SECRET: "x".repeat(32),
    ADMIN_EMAILS: "",
    ADMIN_BOOTSTRAP_PASSWORD: "",
    CRON_SECRET: "",
    NVIDIA_API_KEY: "",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    NVIDIA_MODEL: "",
    TAVILY_API_KEY: "",
  }),
}));

describe("ingestSearchResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid URLs", async () => {
    const { ingestSearchResult } = await import(
      "@/domain/candidate/candidate-service"
    );

    const outcome = await ingestSearchResult({} as never, {
      result: { title: "x", url: "javascript:alert(1)", content: "y" },
      searchQuery: "q",
    });

    expect(outcome.status).toBe("INVALID");
  });

  it("marks duplicates against existing candidates", async () => {
    findCandidateByCanonicalUrl.mockResolvedValue({ id: "existing" });
    findCourseByCanonicalUrl.mockResolvedValue(null);

    const { ingestSearchResult } = await import(
      "@/domain/candidate/candidate-service"
    );

    const outcome = await ingestSearchResult({} as never, {
      result: {
        title: "Python",
        url: "https://www.coursera.org/learn/python?utm_source=x",
        content: "desc",
      },
      searchQuery: "python",
    });

    expect(outcome).toEqual({
      status: "DUPLICATE",
      reason: "CANDIDATE",
      existingId: "existing",
    });
    expect(createCandidate).not.toHaveBeenCalled();
  });

  it("creates candidates for new URLs", async () => {
    findCandidateByCanonicalUrl.mockResolvedValue(null);
    findCourseByCanonicalUrl.mockResolvedValue(null);
    createCandidate.mockResolvedValue({
      id: "new-1",
      canonicalUrl: "https://coursera.org/learn/python",
    });

    const { ingestSearchResult } = await import(
      "@/domain/candidate/candidate-service"
    );

    const outcome = await ingestSearchResult({} as never, {
      result: {
        title: "Python",
        url: "https://www.coursera.org/learn/python?utm_source=x",
        content: "desc",
      },
      searchQuery: "python",
      providerHint: "coursera",
    });

    expect(outcome.status).toBe("CREATED");
    expect(createCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        canonicalUrl: "https://coursera.org/learn/python",
        discoveryStatus: "DISCOVERED",
      }),
    );
  });
});

describe("runDiscoveryBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes search results into candidates", async () => {
    listDueDiscoveryQueries.mockResolvedValue([
      {
        id: "q1",
        provider: "coursera",
        category: "ai",
        query: "site:coursera.org ai",
      },
    ]);
    findCandidateByCanonicalUrl.mockResolvedValue(null);
    findCourseByCanonicalUrl.mockResolvedValue(null);
    createCandidate.mockResolvedValue({ id: "c1" });
    markDiscoveryQuerySuccess.mockResolvedValue(undefined);

    const { runDiscoveryBatch } = await import(
      "@/domain/discovery/discovery-engine"
    );

    const summary = await runDiscoveryBatch(
      {} as never,
      {
        search: async () => [
          {
            title: "AI Course",
            url: "https://coursera.org/learn/ai",
            content: "free",
          },
        ],
      },
      { queryLimit: 1, resultLimit: 5 },
    );

    expect(summary).toEqual({
      queriesProcessed: 1,
      created: 1,
      duplicates: 0,
      invalid: 0,
      errors: 0,
    });
    expect(markDiscoveryQuerySuccess).toHaveBeenCalledWith({}, "q1");
  });

  // P1-04 regression: the admin discovery API accepted provider/category and dropped them.
  it("scopes the run to the requested provider and topic", async () => {
    listDueDiscoveryQueries.mockResolvedValue([]);

    const { runDiscoveryBatch } = await import(
      "@/domain/discovery/discovery-engine"
    );

    await runDiscoveryBatch(
      {} as never,
      { search: async () => [] },
      { queryLimit: 3, provider: "coursera", category: "ai" },
    );

    expect(listDueDiscoveryQueries).toHaveBeenCalledWith({}, 3, {
      provider: "coursera",
      category: "ai",
    });
  });

  // A successful run pushes nextRunAt 24h out, so a manual re-run found nothing.
  it("forwards ignoreSchedule so manual runs bypass the 24h cooldown", async () => {
    listDueDiscoveryQueries.mockResolvedValue([]);

    const { runDiscoveryBatch } = await import(
      "@/domain/discovery/discovery-engine"
    );

    await runDiscoveryBatch(
      {} as never,
      { search: async () => [] },
      { queryLimit: 3, ignoreSchedule: true },
    );

    expect(listDueDiscoveryQueries).toHaveBeenCalledWith(
      {},
      3,
      expect.objectContaining({ ignoreSchedule: true }),
    );
  });

  it("records query failures without crashing the batch", async () => {
    listDueDiscoveryQueries.mockResolvedValue([
      {
        id: "q2",
        provider: "udemy",
        category: "programming",
        query: "site:udemy.com python",
      },
    ]);
    markDiscoveryQueryFailure.mockResolvedValue(undefined);

    const { runDiscoveryBatch } = await import(
      "@/domain/discovery/discovery-engine"
    );

    const summary = await runDiscoveryBatch(
      {} as never,
      {
        search: async () => {
          throw new Error("Tavily timeout");
        },
      },
    );

    expect(summary.errors).toBe(1);
    expect(markDiscoveryQueryFailure).toHaveBeenCalledWith({}, "q2");
  });
});
