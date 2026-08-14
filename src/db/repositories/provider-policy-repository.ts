import { eq } from "drizzle-orm";

import type { Db } from "@/db";
import { providerPolicies, providers } from "@/db/schema";
import type { ProviderPolicyRule } from "@/domain/verification/provider-policy";

/**
 * Provider policies as the resolvers want them: keyed by provider slug rather
 * than id, with the DB row's lifecycle columns carried through so
 * `resolveCertificateWithPolicy` and `resolvePriceType` can apply `active` and
 * `effective_from` themselves.
 *
 * Reading these per call would be wasteful; callers load once per batch or per
 * request and pass the result down.
 */
export async function listProviderPolicyRules(
  db: Db,
): Promise<ProviderPolicyRule[]> {
  const rows = await db
    .select({
      providerSlug: providers.slug,
      priceType: providerPolicies.priceType,
      certificateType: providerPolicies.certificateType,
      evidenceUrl: providerPolicies.evidenceUrl,
      policyNote: providerPolicies.policyNote,
      effectiveFrom: providerPolicies.effectiveFrom,
      active: providerPolicies.active,
      catalogWideFree: providerPolicies.catalogWideFree,
    })
    .from(providerPolicies)
    .innerJoin(providers, eq(providerPolicies.providerId, providers.id));

  return rows.map((row) => ({
    providerSlug: row.providerSlug,
    priceType: row.priceType,
    certificateType: row.certificateType,
    evidenceUrl: row.evidenceUrl,
    policyNote: row.policyNote,
    effectiveFrom: row.effectiveFrom,
    active: row.active,
    catalogWideFree: row.catalogWideFree,
  }));
}
