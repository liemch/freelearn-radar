/**
 * M20.1 lexical query prep (plan §87).
 * DB-side matching uses immutable_unaccent + pg_trgm; this module prepares
 * the query string, aliases, and tokens for SQL and for unit tests.
 */

export const LEXICAL_RANKING_CONFIG_VERSION = "lexical-v1";

/** Similarity floor for title typo fallback (pg_trgm). */
export const LEXICAL_TITLE_SIMILARITY_THRESHOLD = 0.28;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "and",
  "or",
  "with",
  "from",
  "by",
  "va",
  "cua",
  "cho",
  "voi",
  "la",
  "cac",
  "nhung",
  "mot",
  "ve",
  "nhu",
]);

/**
 * Canonical provider / product aliases → expansion tokens appended to the query.
 * Keys and values are compared after diacritic strip + lowercasing.
 */
export const PROVIDER_ALIASES: Record<string, string> = {
  "ms learn": "microsoft learn",
  mslearn: "microsoft learn",
  "ms-learn": "microsoft learn",
  "microsoft learning": "microsoft learn",
  "google cloud": "google cloud platform",
  gcp: "google cloud platform",
  aws: "amazon web services",
  "amazon aws": "amazon web services",
  edx: "ed x",
};

export function stripDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function tokenizeLexical(normalized: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of normalized.split(/[^a-z0-9]+/i)) {
    const token = raw.toLowerCase();
    if (!token || STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export function expandProviderAliases(normalizedFolded: string): string {
  let expanded = normalizedFolded;
  for (const [alias, canonical] of Object.entries(PROVIDER_ALIASES)) {
    if (expanded.includes(alias)) {
      if (!expanded.includes(canonical)) {
        expanded = `${expanded} ${canonical}`;
      }
    }
  }
  return expanded.replace(/\s+/g, " ").trim();
}

export type PreparedLexicalQuery = {
  /** Display / logging form (trimmed, collapsed whitespace, max 200). */
  display: string;
  /** Diacritic-folded lowercase string used for LIKE / similarity. */
  folded: string;
  /** Alias-expanded folded string. */
  foldedExpanded: string;
  tokens: string[];
  /** LIKE pattern with wildcards escaped. */
  likePattern: string;
};

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Prepare a public search string for lexical retrieval.
 * Empty input returns null (caller should skip text match).
 */
export function prepareLexicalQuery(
  raw: string | null | undefined,
): PreparedLexicalQuery | null {
  if (!raw) return null;
  const display = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  if (!display) return null;

  const folded = stripDiacritics(display).toLowerCase().replace(/\s+/g, " ").trim();
  if (!folded) return null;

  const foldedExpanded = expandProviderAliases(folded);
  const tokens = tokenizeLexical(foldedExpanded);

  return {
    display,
    folded,
    foldedExpanded,
    tokens,
    likePattern: `%${escapeLikePattern(foldedExpanded)}%`,
  };
}
