import { z } from "zod";

import { getServerEnv } from "@/lib/env";

export const nlIntentSchema = z.object({
  topics: z.array(z.string()),
  level: z.string().optional(),
  maxDurationMinutes: z.number().int().positive().optional(),
  certificateRequired: z.boolean().optional(),
  language: z.string().optional(),
  rawQuery: z.string(),
});

export type NlIntent = z.infer<typeof nlIntentSchema>;

export type NlIntentParseResult = {
  intent: NlIntent;
  source: "DETERMINISTIC" | "AI_STUB";
  rateLimited: boolean;
};

const LEVEL_KEYWORDS: Array<{ tokens: string[]; level: string }> = [
  {
    tokens: [
      "beginner",
      "beginners",
      "newbie",
      "intro",
      "introduction",
      "co ban",
      "nguoi moi",
    ],
    level: "BEGINNER",
  },
  { tokens: ["intermediate", "trung cap"], level: "INTERMEDIATE" },
  { tokens: ["advanced", "expert", "nang cao", "chuyen sau"], level: "ADVANCED" },
];

/**
 * Query tokens that map to catalog topics. Multi-word phrases first so
 * "machine learning" wins over a bare "learning" token.
 */
const TOPIC_KEYWORDS: Array<{ phrase: string; topic: string }> = [
  { phrase: "machine learning", topic: "ai" },
  { phrase: "deep learning", topic: "ai" },
  { phrase: "data science", topic: "data-science" },
  { phrase: "data analysis", topic: "data-science" },
  { phrase: "project management", topic: "project-management" },
  { phrase: "quan ly du an", topic: "project-management" },
  { phrase: "an toan thong tin", topic: "cybersecurity" },
  { phrase: "tri tue nhan tao", topic: "ai" },
  { phrase: "lap trinh", topic: "programming" },
  { phrase: "python", topic: "python" },
  { phrase: "javascript", topic: "programming" },
  { phrase: "typescript", topic: "programming" },
  { phrase: "java", topic: "programming" },
  { phrase: "sql", topic: "data-science" },
  { phrase: "ai", topic: "ai" },
  { phrase: "cybersecurity", topic: "cybersecurity" },
  { phrase: "security", topic: "cybersecurity" },
  { phrase: "cloud", topic: "cloud" },
  { phrase: "aws", topic: "cloud" },
  { phrase: "azure", topic: "cloud" },
  { phrase: "programming", topic: "programming" },
  { phrase: "coding", topic: "programming" },
];

const CERTIFICATE_RE = /\b(certificate|certification|cert|chung chi)\b/i;
const CERTIFICATE_VI_RE = /chứng chỉ/i;
const HOURS_RE = /(?:under|less than|max|<=?)?\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|giờ|gio)/i;
const MINUTES_RE = /(?:under|less than|max|<=?)?\s*(\d+)\s*(minutes?|mins?|phút|phut)/i;
const ENGLISH_RE = /\b(in english|english only)\b/i;
const VIETNAMESE_RE = /(tiếng việt|tieng viet)/i;

function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function parseIntentDeterministic(query: string): NlIntent {
  const rawQuery = query.trim();
  const lower = rawQuery.toLowerCase();
  const folded = stripDiacritics(lower);

  const topics: string[] = [];
  let remaining = folded;
  for (const { phrase, topic } of TOPIC_KEYWORDS) {
    const re = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "i");
    if (re.test(remaining) && !topics.includes(topic)) {
      topics.push(topic);
      remaining = remaining.replace(re, " ");
    }
  }

  let level: string | undefined;
  for (const { tokens, level: mapped } of LEVEL_KEYWORDS) {
    if (tokens.some((t) => new RegExp(`\\b${t}\\b`, "i").test(folded))) {
      level = mapped;
      break;
    }
  }

  let maxDurationMinutes: number | undefined;
  const minutesMatch = lower.match(MINUTES_RE) ?? folded.match(MINUTES_RE);
  const hoursMatch = lower.match(HOURS_RE) ?? folded.match(HOURS_RE);
  if (minutesMatch) {
    maxDurationMinutes = Number.parseInt(minutesMatch[1]!, 10);
  } else if (hoursMatch) {
    maxDurationMinutes = Math.round(Number.parseFloat(hoursMatch[1]!) * 60);
  }
  if (maxDurationMinutes !== undefined && maxDurationMinutes <= 0) {
    maxDurationMinutes = undefined;
  }

  const certificateRequired =
    CERTIFICATE_RE.test(folded) || CERTIFICATE_VI_RE.test(lower)
      ? true
      : undefined;

  let language: string | undefined;
  if (VIETNAMESE_RE.test(lower) || VIETNAMESE_RE.test(folded)) {
    language = "vi";
  } else if (ENGLISH_RE.test(lower)) {
    language = "en";
  }

  return nlIntentSchema.parse({
    topics,
    level,
    maxDurationMinutes,
    certificateRequired,
    language,
    rawQuery,
  });
}

type NlIntentLimits = {
  featureEnabled: boolean;
  perIpHourly: number;
  dailyCalls: number;
  maxQueryChars: number;
};

function readLimits(): NlIntentLimits {
  try {
    const env = getServerEnv();
    return {
      featureEnabled: env.FEATURE_NL_COURSE_FINDER === "true",
      perIpHourly: env.NL_INTENT_PER_IP_HOURLY,
      dailyCalls: env.NL_INTENT_DAILY_CALLS,
      maxQueryChars: env.NL_INTENT_MAX_QUERY_CHARS,
    };
  } catch {
    return {
      featureEnabled: process.env.FEATURE_NL_COURSE_FINDER === "true",
      perIpHourly: Number(process.env.NL_INTENT_PER_IP_HOURLY) || 20,
      dailyCalls: Number(process.env.NL_INTENT_DAILY_CALLS) || 2000,
      maxQueryChars: Number(process.env.NL_INTENT_MAX_QUERY_CHARS) || 512,
    };
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const ipHourlyCounters = new Map<string, { windowStart: number; count: number }>();
let dailyCounter = { windowStart: 0, count: 0 };

export type NlIntentQuotaResult = {
  allowed: boolean;
  reason: "OK" | "IP_HOURLY_LIMIT" | "DAILY_LIMIT";
};

/**
 * Process-memory quota (plan §92.4). Deliberately not durable: a restart
 * resets counters, which only ever fails open toward the deterministic parser.
 */
export function consumeNlIntentQuota(
  ip: string,
  now: Date = new Date(),
): NlIntentQuotaResult {
  const limits = readLimits();
  const ts = now.getTime();

  if (ts - dailyCounter.windowStart >= DAY_MS) {
    dailyCounter = { windowStart: ts, count: 0 };
  }
  if (dailyCounter.count >= limits.dailyCalls) {
    return { allowed: false, reason: "DAILY_LIMIT" };
  }

  const key = ip || "unknown";
  const entry = ipHourlyCounters.get(key);
  if (!entry || ts - entry.windowStart >= HOUR_MS) {
    ipHourlyCounters.set(key, { windowStart: ts, count: 1 });
    dailyCounter.count += 1;
    return { allowed: true, reason: "OK" };
  }
  if (entry.count >= limits.perIpHourly) {
    return { allowed: false, reason: "IP_HOURLY_LIMIT" };
  }

  entry.count += 1;
  dailyCounter.count += 1;
  return { allowed: true, reason: "OK" };
}

export function resetNlIntentQuota(): void {
  ipHourlyCounters.clear();
  dailyCounter = { windowStart: 0, count: 0 };
}

/**
 * Flag-gated parse.
 *
 * There is no AI intent call in this release: the `AI_STUB` source means quota
 * was accounted for and the deterministic parse was returned unchanged. Keeping
 * the shape stable means adding a real AI path later cannot change the result
 * contract (§92.2). Treat a non-`DETERMINISTIC` source as "metered", not as
 * evidence that a model ran.
 */
export async function parseIntentWithOptionalAi(
  query: string,
  options?: { ip?: string; now?: Date },
): Promise<NlIntentParseResult> {
  const limits = readLimits();
  const bounded = query.slice(0, limits.maxQueryChars);
  const deterministic = parseIntentDeterministic(bounded);

  if (!limits.featureEnabled) {
    return { intent: deterministic, source: "DETERMINISTIC", rateLimited: false };
  }

  const quota = consumeNlIntentQuota(options?.ip ?? "unknown", options?.now);
  if (!quota.allowed) {
    return { intent: deterministic, source: "DETERMINISTIC", rateLimited: true };
  }

  return { intent: deterministic, source: "AI_STUB", rateLimited: false };
}

/**
 * Narrows catalog filters with constraints the query stated in prose, so
 * "python cho người mới dưới 3 giờ có chứng chỉ" actually filters instead of
 * being matched as one long keyword string.
 *
 * Intent only ever *narrows*: an explicit UI filter always wins, and no
 * inferred constraint may widen eligibility, because Truth — not intent —
 * decides what is allowed to appear (§90.2).
 */
export function applyNlIntentToFilters<
  T extends {
    level?: string;
    language?: string;
    certificateType?: string;
    durationMaxMinutes?: number | null;
  },
>(filters: T, intent: NlIntent): T {
  const next: T = { ...filters };

  if (!next.level && intent.level) {
    next.level = intent.level;
  }
  if (
    next.durationMaxMinutes == null &&
    intent.maxDurationMinutes !== undefined
  ) {
    next.durationMaxMinutes = intent.maxDurationMinutes;
  }
  if (!next.language && intent.language === "vi") {
    // Only the explicit "tiếng Việt" ask narrows language. An English-language
    // hint must not be applied, or a Vietnamese query would stop retrieving
    // international courses (§116.6).
    next.language = "Vietnamese";
  }

  return next;
}
