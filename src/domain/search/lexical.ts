/**
 * M20.1 lexical query prep (plan §87).
 * DB-side matching uses immutable_unaccent + pg_trgm; this module prepares
 * the query string, aliases, and tokens for SQL and for unit tests.
 */

export const LEXICAL_RANKING_CONFIG_VERSION = "lexical-v1";

/**
 * Whole-string trigram floor. Only meaningful when the query length is close to
 * the title length; a short query against a long title cannot reach it, because
 * `similarity()` divides shared trigrams by the union of both strings.
 */
export const LEXICAL_TITLE_SIMILARITY_THRESHOLD = 0.28;

/**
 * Word-level trigram floor — this is what actually delivers the typo tolerance
 * §87.2 promises. `word_similarity(query, title)` scores the best word-boundary
 * span of the title instead of the whole string, so query length stops mattering.
 *
 * Measured against the catalog fixtures (title | query | similarity | word_similarity):
 *   excel co ban mien phi        | excel  | 0.273 | 1.000   ← exact word, misses 0.28
 *   ai for beginners             | ai     | 0.177 | 1.000   ← exact word, misses 0.28
 *   khoa hoc python cho nguoi... | pyton  | 0.103 | 0.500   ← 1-char typo
 *   khoa hoc python cho nguoi... | excel  | 0.000 | 0.000   ← unrelated
 *   graphic design with canva    | python | 0.000 | 0.000   ← unrelated
 *   khoa hoc python cho nguoi... | cooking recipes | 0.019 | 0.063 ← unrelated
 *
 * 0.5 admits single-character typos in words of six or more characters while
 * staying roughly eight times above the strongest unrelated score.
 */
export const LEXICAL_WORD_SIMILARITY_THRESHOLD = 0.5;

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

/**
 * Vietnamese concept → English catalog wording.
 *
 * The catalog is international (§116.6) while the UI and the queries are
 * Vietnamese, and no lexical operator can bridge the two: "quan ly du an" scores
 * 0.000 similarity *and* 0.000 word_similarity against "Project Management
 * Fundamentals". Semantic retrieval is the general answer, but it stays off until
 * its relevance floor is calibrated, so these deterministic aliases carry the
 * plan's own worked examples (§96.1) in the meantime.
 *
 * Keys are compared after diacritic-strip + lowercase, so both "quản lý dự án"
 * and "quan ly du an" hit the same entry. Values are added as separate search
 * phrases, never concatenated into the original query.
 */
export const CONCEPT_ALIASES: Record<string, string[]> = {
  "quan ly du an": ["project management"],
  "quan tri du an": ["project management"],
  "tri tue nhan tao": ["artificial intelligence", "ai"],
  "hoc may": ["machine learning"],
  "khoa hoc du lieu": ["data science"],
  "phan tich du lieu": ["data analytics", "data analysis"],
  "an toan thong tin": ["cyber security", "cybersecurity"],
  "lap trinh web": ["web development"],
  "lap trinh": ["programming"],
  "co so du lieu": ["database"],
  "tiep thi so": ["digital marketing"],
  "ky nang giao tiep": ["communication skills"],
  "ky nang mem": ["soft skills"],
  "quan ly thoi gian": ["time management"],
  "phat trien ban than": ["personal development"],
  "tai chinh ca nhan": ["personal finance"],
  "ke toan": ["accounting"],
  "thiet ke do hoa": ["graphic design"],
  "dien toan dam may": ["cloud computing"],
  "tieng anh": ["english"],
};

/**
 * Returns the alias canonical forms triggered by a query, as separate phrases.
 *
 * Appending them to the query string instead would break the LIKE branch: a
 * pattern of `%ms learn microsoft learn%` matches no title. Multi-word concepts
 * are likewise kept apart — "artificial intelligence ai" as one phrase would
 * match neither "Artificial Intelligence" nor "AI for Beginners".
 *
 * Only topic concepts are aliased. Level words ("co ban", "nguoi moi") are
 * deliberately excluded: they broaden every query without narrowing the topic,
 * and level intent is already extracted as a filter by the intent parser.
 */
export function aliasPhrasesFor(normalizedFolded: string): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();

  const add = (canonical: string) => {
    if (normalizedFolded.includes(canonical) || seen.has(canonical)) return;
    seen.add(canonical);
    phrases.push(canonical);
  };

  for (const [alias, canonical] of Object.entries(PROVIDER_ALIASES)) {
    if (normalizedFolded.includes(alias)) add(canonical);
  }
  for (const [alias, canonicals] of Object.entries(CONCEPT_ALIASES)) {
    if (!normalizedFolded.includes(alias)) continue;
    for (const canonical of canonicals) add(canonical);
  }

  return phrases;
}

export function expandProviderAliases(normalizedFolded: string): string {
  const extra = aliasPhrasesFor(normalizedFolded);
  if (extra.length === 0) return normalizedFolded.replace(/\s+/g, " ").trim();
  return `${normalizedFolded} ${extra.join(" ")}`.replace(/\s+/g, " ").trim();
}

export type PreparedLexicalQuery = {
  /** Display / logging form (trimmed, collapsed whitespace, max 200). */
  display: string;
  /** Diacritic-folded lowercase string used for LIKE / similarity. */
  folded: string;
  /** Alias-expanded folded string (whole-string similarity only). */
  foldedExpanded: string;
  tokens: string[];
  /** LIKE pattern with wildcards escaped. */
  likePattern: string;
  /** The query plus each alias canonical, as independently matchable phrases. */
  phrases: string[];
  /** One escaped LIKE pattern per phrase. */
  likePatterns: string[];
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
  const phrases = [folded, ...aliasPhrasesFor(folded)];

  return {
    display,
    folded,
    foldedExpanded,
    tokens,
    likePattern: `%${escapeLikePattern(folded)}%`,
    phrases,
    likePatterns: phrases.map((phrase) => `%${escapeLikePattern(phrase)}%`),
  };
}
