/**
 * M21.8 — Interests preference (client-side, no account).
 * Soft ranking only — does not override Truth or organic search.
 */

export const INTEREST_STORAGE_KEY = "flr.interests.v1";

export const INTEREST_OPTIONS = [
  { slug: "soft-skills", label: "Kỹ năng mềm" },
  { slug: "ai", label: "AI" },
  { slug: "languages", label: "Tiếng Anh / Ngoại ngữ" },
  { slug: "personal-development", label: "Phát triển bản thân" },
  { slug: "finance", label: "Tài chính" },
  { slug: "office-productivity", label: "Excel / Văn phòng" },
  { slug: "programming", label: "Lập trình" },
  { slug: "business", label: "Kinh doanh" },
  { slug: "design", label: "Thiết kế" },
  { slug: "lifestyle-health", label: "Cuộc sống & Sức khỏe" },
  { slug: "career", label: "Nghề nghiệp" },
] as const;

export type InterestSlug = (typeof INTEREST_OPTIONS)[number]["slug"];

export function parseInterestSlugs(raw: unknown): InterestSlug[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(INTEREST_OPTIONS.map((o) => o.slug));
  const out: InterestSlug[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item as InterestSlug)) {
      out.push(item as InterestSlug);
    }
  }
  return [...new Set(out)].slice(0, 8);
}

export function readInterestsFromStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
): InterestSlug[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(INTEREST_STORAGE_KEY);
    if (!raw) return [];
    return parseInterestSlugs(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeInterestsToStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  slugs: InterestSlug[],
): void {
  if (!storage) return;
  storage.setItem(
    INTEREST_STORAGE_KEY,
    JSON.stringify(parseInterestSlugs(slugs)),
  );
}

/**
 * Soft boost for "Dành cho bạn" — never gates eligibility.
 * Higher score = more preferred; Truth filter already applied upstream.
 */
export function interestBoostScore(
  courseCategorySlugs: string[],
  interests: InterestSlug[],
): number {
  if (interests.length === 0) return 0;
  let score = 0;
  for (const slug of courseCategorySlugs) {
    if (interests.includes(slug as InterestSlug)) score += 10;
  }
  return score;
}

export function softRankByInterests<T extends { id: string }>(
  items: T[],
  getCategorySlugs: (item: T) => string[],
  interests: InterestSlug[],
): T[] {
  if (interests.length === 0) return items;
  return [...items].sort((a, b) => {
    const diff =
      interestBoostScore(getCategorySlugs(b), interests) -
      interestBoostScore(getCategorySlugs(a), interests);
    return diff;
  });
}
