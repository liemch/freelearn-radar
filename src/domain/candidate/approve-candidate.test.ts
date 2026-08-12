import { describe, expect, it, vi } from "vitest";

const findCandidateById = vi.fn();
const updateCandidate = vi.fn();
const createCourse = vi.fn();
const findCourseByCanonicalUrl = vi.fn();
const findCourseBySlug = vi.fn();
const setCourseCategories = vi.fn();
const listCategories = vi.fn();
const listProviders = vi.fn();

vi.mock("@/db/repositories/candidate-repository", () => ({
  findCandidateById: (...args: unknown[]) => findCandidateById(...args),
  updateCandidate: (...args: unknown[]) => updateCandidate(...args),
}));

vi.mock("@/db/repositories/course-repository", () => ({
  createCourse: (...args: unknown[]) => createCourse(...args),
  findCourseByCanonicalUrl: (...args: unknown[]) =>
    findCourseByCanonicalUrl(...args),
  findCourseBySlug: (...args: unknown[]) => findCourseBySlug(...args),
  setCourseCategories: (...args: unknown[]) => setCourseCategories(...args),
}));

vi.mock("@/db/repositories/category-repository", () => ({
  listCategories: (...args: unknown[]) => listCategories(...args),
}));

vi.mock("@/db/repositories/provider-repository", () => ({
  listProviders: (...args: unknown[]) => listProviders(...args),
}));

vi.mock("@/db/repositories/verification-repository", () => ({
  createVerification: vi.fn().mockResolvedValue({ id: "ver-1" }),
}));

function baseCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand-1",
    canonicalUrl: "https://coursera.org/learn/python",
    rawTitle: "Python",
    rawDescription: "desc",
    rawContent: "content",
    provider: "coursera",
    discoveryStatus: "READY_FOR_REVIEW",
    aiAnalysisJson: {
      is_course: true,
      provider: "Coursera",
      title: "Python Basics",
      categories: ["Programming"],
      level: "BEGINNER",
      language: "English",
      price_type: "FREE_AUDIT",
      certificate_type: "PAID_CERTIFICATE",
      duration_minutes: 120,
      summary_vi: "Tom tat",
      why_learn: "Ly do",
      pros: [],
      cons: [],
      quality_score: 80,
      confidence: 0.9,
    },
    ...overrides,
  };
}

describe("approveCandidate", () => {
  it("creates a published course transactionally from candidate analysis", async () => {
    findCandidateById.mockResolvedValue(baseCandidate());
    findCourseByCanonicalUrl.mockResolvedValue(null);
    findCourseBySlug.mockResolvedValue(null);
    listProviders.mockResolvedValue([
      { id: "p1", slug: "coursera", name: "Coursera" },
    ]);
    listCategories.mockResolvedValue([
      { id: "cat1", slug: "programming", name: "Programming" },
    ]);
    createCourse.mockResolvedValue({
      id: "course-1",
      slug: "python-basics",
      status: "PUBLISHED",
    });
    setCourseCategories.mockResolvedValue(undefined);
    updateCandidate.mockResolvedValue({
      id: "cand-1",
      discoveryStatus: "APPROVED",
    });

    const db = {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    };

    const { approveCandidate } = await import(
      "@/domain/candidate/approve-candidate"
    );

    const course = await approveCandidate(db as never, {
      candidateId: "cand-1",
    });

    expect(course.id).toBe("course-1");
    expect(createCourse).toHaveBeenCalled();
  });

  it("rejects candidates that are not ready for review", async () => {
    findCandidateById.mockResolvedValue(
      baseCandidate({ discoveryStatus: "DISCOVERED" }),
    );

    const { approveCandidate } = await import(
      "@/domain/candidate/approve-candidate"
    );

    await expect(
      approveCandidate({} as never, { candidateId: "cand-1" }),
    ).rejects.toThrow(/cannot be approved/);
  });

  it("rejects unresolved providers instead of falling back", async () => {
    findCandidateById.mockResolvedValue(
      baseCandidate({
        provider: "unknown-provider",
        aiAnalysisJson: {
          ...baseCandidate().aiAnalysisJson,
          provider: "Totally Unknown Platform",
        },
      }),
    );
    listProviders.mockResolvedValue([
      { id: "p1", slug: "udemy", name: "Udemy" },
    ]);

    const { approveCandidate } = await import(
      "@/domain/candidate/approve-candidate"
    );

    await expect(
      approveCandidate({} as never, { candidateId: "cand-1" }),
    ).rejects.toThrow(/Unable to resolve provider/);
  });
});
