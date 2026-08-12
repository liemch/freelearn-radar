import { beforeEach, describe, expect, it, vi } from "vitest";

const findCandidateById = vi.fn();
const updateCandidate = vi.fn();

vi.mock("@/db/repositories/candidate-repository", () => ({
  findCandidateById: (...args: unknown[]) => findCandidateById(...args),
  updateCandidate: (...args: unknown[]) => updateCandidate(...args),
  listCandidatesByStatus: vi.fn(),
}));

describe("analyzeCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks candidate ready for review on successful analysis", async () => {
    findCandidateById.mockResolvedValue({
      id: "c1",
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
  });

  it("routes low-confidence analysis to ANALYZED for extra review", async () => {
    findCandidateById.mockResolvedValue({
      id: "c3",
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
});
