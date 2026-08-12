/**
 * Deterministic pre-filter before spending AI budget.
 * Rejects obvious non-course pages; learning paths are allowed.
 */

export type CandidateQuality =
  | "LIKELY_COURSE"
  | "LIKELY_LEARNING_PATH"
  | "LIKELY_NON_COURSE"
  | "UNKNOWN";

export type PrefilterResult = {
  quality: CandidateQuality;
  accept: boolean;
  reason: string;
};

const NON_COURSE_PATH = [
  /\/blog\//i,
  /\/news\//i,
  /\/press\//i,
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/register/i,
  /\/pricing\/?$/i,
  /\/plans\/?$/i,
  /\/search\?/i,
  /\/search\/?$/i,
  /\/tag\//i,
  /\/tags\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/cart/i,
  /\/checkout/i,
  /\/about\/?$/i,
  /\/careers/i,
];

const LEARNING_PATH = [
  /\/path\//i,
  /\/learning-path/i,
  /\/career-path/i,
  /\/curriculum/i,
  /\/specialization/i,
  /\/professional-certificate/i,
];

const COURSE_HINT = [
  /\/learn\//i,
  /\/course\//i,
  /\/courses\//i,
  /\/class\//i,
  /\/training\//i,
  /\/module\//i,
  /\/tutorial/i,
];

export function prefilterCandidate(input: {
  url: string;
  title?: string | null;
  content?: string | null;
}): PrefilterResult {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return {
      quality: "LIKELY_NON_COURSE",
      accept: false,
      reason: "Invalid URL",
    };
  }

  const path = `${url.pathname}${url.search}`;
  const blob = `${input.title ?? ""} ${input.content ?? ""}`.toLowerCase();

  for (const pattern of NON_COURSE_PATH) {
    if (pattern.test(path) || pattern.test(url.href)) {
      return {
        quality: "LIKELY_NON_COURSE",
        accept: false,
        reason: `Non-course URL pattern: ${pattern.source}`,
      };
    }
  }

  if (
    /\b(blog post|news article|press release)\b/i.test(blob) &&
    !COURSE_HINT.some((p) => p.test(path))
  ) {
    return {
      quality: "LIKELY_NON_COURSE",
      accept: false,
      reason: "Content looks like blog/news",
    };
  }

  if (LEARNING_PATH.some((p) => p.test(path))) {
    return {
      quality: "LIKELY_LEARNING_PATH",
      accept: true,
      reason: "Learning path / specialization URL",
    };
  }

  if (COURSE_HINT.some((p) => p.test(path))) {
    return {
      quality: "LIKELY_COURSE",
      accept: true,
      reason: "Course-like URL",
    };
  }

  // Prompt-injection style titles must still go through as content candidates
  // only if URL looks plausible — otherwise unknown.
  if (/ignore (all|previous) instructions/i.test(blob)) {
    return {
      quality: "UNKNOWN",
      accept: true,
      reason: "Suspicious instruction-like content kept for AI sandboxing",
    };
  }

  return {
    quality: "UNKNOWN",
    accept: true,
    reason: "No strong reject signal",
  };
}

/** True when AI analysis can be skipped because inputs are unchanged. */
export function shouldReuseAnalysis(input: {
  previousContentHash?: string | null;
  currentContentHash: string;
  previousAnalyzedAt?: Date | null;
  maxAgeHours?: number;
  now?: Date;
}): boolean {
  if (!input.previousContentHash || !input.previousAnalyzedAt) {
    return false;
  }
  if (input.previousContentHash !== input.currentContentHash) {
    return false;
  }
  const maxAge = (input.maxAgeHours ?? 72) * 60 * 60 * 1000;
  const now = input.now ?? new Date();
  return now.getTime() - input.previousAnalyzedAt.getTime() < maxAge;
}

export function simpleContentHash(parts: Array<string | null | undefined>): string {
  const raw = parts.map((part) => (part ?? "").trim()).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
