/**
 * Per-provider fetch / image policy for course source inspection.
 * Code-config only — not a full robots crawler.
 */

export type FetchPolicy =
  | "FETCH_ALLOWED"
  | "METADATA_ONLY"
  | "SEARCH_RESULT_ONLY"
  | "NO_FETCH";

export type ImageStoragePolicy =
  | "STORE_COPY"
  | "REMOTE_ONLY"
  | "NO_EXTERNAL_IMAGE";

export type ProviderFetchPolicy = {
  fetch: FetchPolicy;
  image: ImageStoragePolicy;
  label: string;
};

const BY_SLUG: Record<string, ProviderFetchPolicy> = {
  coursera: {
    fetch: "FETCH_ALLOWED",
    image: "REMOTE_ONLY",
    label: "Coursera",
  },
  udemy: {
    fetch: "FETCH_ALLOWED",
    image: "REMOTE_ONLY",
    label: "Udemy",
  },
  edx: {
    fetch: "FETCH_ALLOWED",
    image: "REMOTE_ONLY",
    label: "edX",
  },
  "microsoft-learn": {
    fetch: "FETCH_ALLOWED",
    image: "REMOTE_ONLY",
    label: "Microsoft Learn",
  },
  freecodecamp: {
    fetch: "FETCH_ALLOWED",
    image: "REMOTE_ONLY",
    label: "freeCodeCamp",
  },
  "linkedin-learning": {
    fetch: "METADATA_ONLY",
    image: "NO_EXTERNAL_IMAGE",
    label: "LinkedIn Learning",
  },
};

const BY_DOMAIN: Record<string, ProviderFetchPolicy> = {
  "coursera.org": BY_SLUG.coursera!,
  "www.coursera.org": BY_SLUG.coursera!,
  "udemy.com": BY_SLUG.udemy!,
  "www.udemy.com": BY_SLUG.udemy!,
  "edx.org": BY_SLUG.edx!,
  "www.edx.org": BY_SLUG.edx!,
  "learn.microsoft.com": BY_SLUG["microsoft-learn"]!,
  "freecodecamp.org": BY_SLUG.freecodecamp!,
  "www.freecodecamp.org": BY_SLUG.freecodecamp!,
  "linkedin.com": BY_SLUG["linkedin-learning"]!,
  "www.linkedin.com": BY_SLUG["linkedin-learning"]!,
};

const DEFAULT_POLICY: ProviderFetchPolicy = {
  fetch: "METADATA_ONLY",
  image: "REMOTE_ONLY",
  label: "default",
};

const NO_FETCH_POLICY: ProviderFetchPolicy = {
  fetch: "NO_FETCH",
  image: "NO_EXTERNAL_IMAGE",
  label: "blocked",
};

export function resolveProviderFetchPolicy(input: {
  providerSlug?: string | null;
  url?: string | null;
}): ProviderFetchPolicy {
  if (input.providerSlug && BY_SLUG[input.providerSlug]) {
    return BY_SLUG[input.providerSlug]!;
  }

  if (input.url) {
    try {
      const host = new URL(input.url).hostname.toLowerCase();
      if (BY_DOMAIN[host]) return BY_DOMAIN[host]!;
      // Block obvious non-course / internal-ish hosts
      if (host.endsWith(".local") || host.endsWith(".internal")) {
        return NO_FETCH_POLICY;
      }
    } catch {
      return NO_FETCH_POLICY;
    }
  }

  return DEFAULT_POLICY;
}

export function canFetchHtml(policy: ProviderFetchPolicy): boolean {
  return policy.fetch === "FETCH_ALLOWED" || policy.fetch === "METADATA_ONLY";
}

export function allowDeepTextExtraction(policy: ProviderFetchPolicy): boolean {
  return policy.fetch === "FETCH_ALLOWED";
}
