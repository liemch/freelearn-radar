import { assertSafeHttpUrl } from "@/lib/url";

export type AffiliateDestinationInput = {
  template: string;
  /** Replaces `{url}` when present. */
  url?: string | null;
  allowedHosts: string[];
};

/**
 * Single outbound boundary for affiliate destinations (plan §113.6).
 * Never invents relevance — only validates and builds tracked URLs.
 */
export function validateAffiliateDestination(raw: string): string {
  const url = assertSafeHttpUrl(raw);
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Affiliate destination must be http(s)");
  }
  return url;
}

export function hostAllowed(host: string, allowedHosts: string[]): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  return allowedHosts.some((allowed) => {
    const a = allowed.replace(/^www\./, "").toLowerCase();
    return normalized === a || normalized.endsWith(`.${a}`);
  });
}

export function resolveAffiliateDestination(
  input: AffiliateDestinationInput,
): string {
  let filled = input.template;
  if (input.url) {
    filled = filled.replaceAll("{url}", encodeURI(input.url));
  }

  const destination = validateAffiliateDestination(filled);
  const host = new URL(destination).hostname;
  if (input.allowedHosts.length > 0 && !hostAllowed(host, input.allowedHosts)) {
    throw new Error(`Affiliate host not allowlisted: ${host}`);
  }
  return destination;
}

export function buildTrackedAffiliatePath(input: {
  campaignKey: string;
  placementKey: string;
  courseSlug?: string | null;
  topicSlug?: string | null;
  locale?: string | null;
}): string {
  const params = new URLSearchParams({
    campaign: input.campaignKey,
    placement: input.placementKey,
  });
  if (input.courseSlug) params.set("course", input.courseSlug);
  if (input.topicSlug) params.set("topic", input.topicSlug);
  if (input.locale) params.set("locale", input.locale);
  return `/go/affiliate?${params.toString()}`;
}

export function disclosureLabel(
  locale: string,
  provider?: { disclosureTextVi?: string | null; disclosureTextEn?: string | null },
): string {
  if (locale === "vi") {
    return provider?.disclosureTextVi?.trim() || "Liên kết tiếp thị";
  }
  return provider?.disclosureTextEn?.trim() || "Affiliate link";
}
