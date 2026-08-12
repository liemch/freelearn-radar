export type MetadataInput = {
  title?: string | null;
  provider?: string | null;
  canonicalUrl?: string | null;
  description?: string | null;
  hasCategory?: boolean;
  level?: string | null;
  language?: string | null;
  durationMinutes?: number | null;
  priceType?: string | null;
  certificateType?: string | null;
  lastVerifiedAt?: Date | null;
};

export type MetadataCompleteness = {
  score: number;
  missing: string[];
  present: string[];
};

const REQUIRED_WEIGHTS: Array<{
  key: keyof MetadataInput | "category" | "verification";
  weight: number;
  check: (input: MetadataInput) => boolean;
  label: string;
}> = [
  { key: "title", weight: 15, label: "title", check: (i) => Boolean(i.title?.trim()) },
  {
    key: "provider",
    weight: 15,
    label: "provider",
    check: (i) => Boolean(i.provider?.trim()),
  },
  {
    key: "canonicalUrl",
    weight: 15,
    label: "canonical URL",
    check: (i) => Boolean(i.canonicalUrl?.trim()),
  },
  {
    key: "description",
    weight: 10,
    label: "description",
    check: (i) => Boolean(i.description?.trim()),
  },
  {
    key: "category",
    weight: 10,
    label: "category",
    check: (i) => Boolean(i.hasCategory),
  },
  {
    key: "level",
    weight: 5,
    label: "level",
    check: (i) => Boolean(i.level) && i.level !== "UNKNOWN",
  },
  {
    key: "language",
    weight: 5,
    label: "language",
    check: (i) => Boolean(i.language?.trim()),
  },
  {
    key: "durationMinutes",
    weight: 5,
    label: "duration",
    check: (i) => typeof i.durationMinutes === "number" && i.durationMinutes > 0,
  },
  {
    key: "priceType",
    weight: 10,
    label: "pricing",
    check: (i) => Boolean(i.priceType) && i.priceType !== "UNKNOWN",
  },
  {
    key: "certificateType",
    weight: 5,
    label: "certificate",
    check: (i) => Boolean(i.certificateType) && i.certificateType !== "UNKNOWN",
  },
  {
    key: "verification",
    weight: 5,
    label: "verification",
    check: (i) => Boolean(i.lastVerifiedAt),
  },
];

export function assessMetadataCompleteness(
  input: MetadataInput,
): MetadataCompleteness {
  const present: string[] = [];
  const missing: string[] = [];
  let score = 0;

  for (const field of REQUIRED_WEIGHTS) {
    if (field.check(input)) {
      score += field.weight;
      present.push(field.label);
    } else {
      missing.push(field.label);
    }
  }

  return { score, missing, present };
}
