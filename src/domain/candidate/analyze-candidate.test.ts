import { beforeEach, describe, expect, it, vi } from "vitest";

const findCandidateById = vi.fn();
const updateCandidate = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("@/db/repositories/candidate-repository", () => ({
  findCandidateById: (...args: unknown[]) => findCandidateById(...args),
  updateCandidate: (...args: unknown[]) => updateCandidate(...args),
  listCandidatesByStatus: vi.fn(),
}));

vi.mock("@/domain/admin/audit-log", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args),
}));

describe("analyzeCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks candidate ready for review on successful analysis", async () => {
    findCandidateById.mockResolvedValue({
      id: "c1",
      discoveryStatus: "FETCHED",
      canonicalUrl: "https://coursera.org/learn/python",
      rawTitle: "Python",
      rawDescription: "d",
      rawContent: "content",
      provider: "coursera",
    });
    updateCandidate.mockImplementation(async (_db, _id, input) => ({
      id: "c1",
      ...input,
    }));

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    const result = await analyzeCandidate(
      {} as never,
      {
        analyzeCourse: async () => ({
          is_course: true,
          provider: "Coursera",
          title: "Python",
          categories: ["Programming"],
          level: "BEGINNER",
          language: "English",
          price_type: "FREE_AUDIT",
          certificate_type: "PAID_CERTIFICATE",
          duration_minutes: 100,
          summary_vi: "Tom tat",
          why_learn: "Ly do",
          pros: [],
          cons: [],
          quality_score: 80,
          confidence: 0.9,
        }),
        categorizeCourse: async () => ["Programming"],
        summarizeCourse: async () => "Tom tat",
      },
      "c1",
    );

    expect(result.discoveryStatus).toBe("READY_FOR_REVIEW");
    expect(writeAuditLog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actorType: "AI",
        action: "CANDIDATE_ANALYZED",
        entityId: "c1",
        before: { discoveryStatus: "FETCHED" },
        after: expect.objectContaining({
          discoveryStatus: "READY_FOR_REVIEW",
        }),
      }),
    );
  });

  it("routes low-confidence analysis to ANALYZED for extra review", async () => {
    findCandidateById.mockResolvedValue({
      id: "c3",
      discoveryStatus: "DISCOVERED",
      canonicalUrl: "https://coursera.org/learn/low",
      rawTitle: "Low",
      rawDescription: "d",
      rawContent: "content",
      provider: "coursera",
    });
    updateCandidate.mockImplementation(async (_db, _id, input) => ({
      id: "c3",
      ...input,
    }));

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    const result = await analyzeCandidate(
      {} as never,
      {
        analyzeCourse: async () => ({
          is_course: true,
          provider: "Coursera",
          title: "Low",
          categories: [],
          level: "UNKNOWN",
          language: "English",
          price_type: "UNKNOWN",
          certificate_type: "UNKNOWN",
          duration_minutes: null,
          summary_vi: "x",
          why_learn: "y",
          pros: [],
          cons: [],
          quality_score: 40,
          confidence: 0.3,
        }),
        categorizeCourse: async () => [],
        summarizeCourse: async () => "x",
      },
      "c3",
    );

    expect(result.discoveryStatus).toBe("ANALYZED");
    expect(result.errorMessage).toMatch(/Low AI confidence/i);
  });

  it("does not crash discovery when AI fails", async () => {
    findCandidateById.mockResolvedValue({
      id: "c2",
      discoveryStatus: "DISCOVERED",
      canonicalUrl: "https://coursera.org/learn/x",
      rawTitle: "X",
      rawDescription: null,
      rawContent: null,
      provider: null,
    });
    updateCandidate.mockImplementation(async (_db, _id, input) => ({
      id: "c2",
      ...input,
    }));

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    const result = await analyzeCandidate(
      {} as never,
      {
        analyzeCourse: async () => {
          throw new Error("AI_PARSE_ERROR");
        },
        categorizeCourse: async () => [],
        summarizeCourse: async () => "",
      },
      "c2",
    );

    expect(result.discoveryStatus).toBe("ERROR");
    expect(result.errorMessage).toContain("AI_PARSE_ERROR");
  });

  const successfulAi = {
    analyzeCourse: async () => ({
      is_course: true as const,
      provider: "Coursera",
      title: "Retried",
      categories: [],
      level: "BEGINNER" as const,
      language: "English",
      price_type: "FREE_AUDIT" as const,
      certificate_type: "UNKNOWN" as const,
      duration_minutes: null,
      summary_vi: "x",
      why_learn: "y",
      pros: [],
      cons: [],
      quality_score: 70,
      confidence: 0.9,
    }),
    categorizeCourse: async () => [],
    summarizeCourse: async () => "x",
  };

  // Admin "Re-analyze" silently no-opped because ERROR is not an auto-analyzable status.
  it("re-analyzes a candidate stuck in ERROR when forced", async () => {
    findCandidateById.mockResolvedValue({
      id: "c4",
      discoveryStatus: "ERROR",
      canonicalUrl: "https://coursera.org/learn/retry",
      rawTitle: "Retried",
      rawDescription: "d",
      rawContent: "content",
      provider: "coursera",
      errorMessage: "AI_PARSE_ERROR",
    });
    updateCandidate.mockImplementation(async (_db, _id, input) => ({
      id: "c4",
      ...input,
    }));

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    const result = await analyzeCandidate({} as never, successfulAi, "c4", {
      force: true,
    });

    expect(result.discoveryStatus).toBe("READY_FOR_REVIEW");
  });

  it("leaves an ERROR candidate untouched during an unforced batch run", async () => {
    findCandidateById.mockResolvedValue({
      id: "c5",
      discoveryStatus: "ERROR",
      canonicalUrl: "https://coursera.org/learn/retry",
      rawTitle: "Retried",
      rawDescription: "d",
      rawContent: "content",
      provider: "coursera",
    });

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    const result = await analyzeCandidate({} as never, successfulAi, "c5");

    expect(result.discoveryStatus).toBe("ERROR");
    expect(updateCandidate).not.toHaveBeenCalled();
  });

  it("refuses to force a candidate out of a terminal status", async () => {
    findCandidateById.mockResolvedValue({
      id: "c6",
      discoveryStatus: "REJECTED",
      canonicalUrl: "https://coursera.org/learn/rejected",
      rawTitle: "Rejected",
      rawDescription: null,
      rawContent: null,
      provider: "coursera",
    });

    const { analyzeCandidate } = await import(
      "@/domain/candidate/analyze-candidate"
    );

    await expect(
      analyzeCandidate({} as never, successfulAi, "c6", { force: true }),
    ).rejects.toThrow(/Cannot re-analyze/i);
  });
});
