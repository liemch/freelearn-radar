/**
 * Conservative title similarity for soft duplicate suggestions.
 * Never auto-merge on title alone.
 */

export function normalizeTitleForCompare(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function titleTokenSet(title: string): Set<string> {
  return new Set(
    normalizeTitleForCompare(title)
      .split(" ")
      .filter((token) => token.length > 1),
  );
}

/** Jaccard similarity on tokens. */
export function titleSimilarity(a: string, b: string): number {
  const sa = titleTokenSet(a);
  const sb = titleTokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;

  let intersection = 0;
  for (const token of sa) {
    if (sb.has(token)) intersection += 1;
  }
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export type SoftDuplicateSuggestion = {
  suggested: boolean;
  similarity: number;
  reason: string;
};

/**
 * Suggest possible duplicate only when same provider AND high title overlap.
 * "Python Basics" vs "Python Basics Advanced" should NOT merge
 * (similarity high but asymmetric length / extra material token).
 */
export function suggestSoftDuplicate(input: {
  titleA: string;
  titleB: string;
  providerA?: string | null;
  providerB?: string | null;
}): SoftDuplicateSuggestion {
  const providerA = (input.providerA ?? "").toLowerCase().trim();
  const providerB = (input.providerB ?? "").toLowerCase().trim();

  if (!providerA || !providerB || providerA !== providerB) {
    return {
      suggested: false,
      similarity: 0,
      reason: "Different or missing provider",
    };
  }

  const na = normalizeTitleForCompare(input.titleA);
  const nb = normalizeTitleForCompare(input.titleB);

  if (na === nb) {
    return {
      suggested: true,
      similarity: 1,
      reason: "Identical normalized title + same provider",
    };
  }

  const similarity = titleSimilarity(input.titleA, input.titleB);

  // Reject asymmetric "Basics" vs "Basics Advanced"
  if (na.includes(nb) || nb.includes(na)) {
    const longer = na.length >= nb.length ? na : nb;
    const shorter = na.length >= nb.length ? nb : na;
    if (longer !== shorter && longer.startsWith(shorter)) {
      return {
        suggested: false,
        similarity,
        reason: "Title extension — likely different course",
      };
    }
  }

  if (similarity >= 0.92) {
    return {
      suggested: true,
      similarity,
      reason: "Very high title similarity + same provider (manual review)",
    };
  }

  return {
    suggested: false,
    similarity,
    reason: "Below conservative duplicate threshold",
  };
}
