import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { getDb } from "@/db";
import {
  affiliateClickStats,
  listAffiliateProviders,
} from "@/db/repositories/affiliate-repository";
import { getSession } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminMonetizationPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const env = getServerEnv();

  let providers: Awaited<ReturnType<typeof listAffiliateProviders>> = [];
  let clicks: Awaited<ReturnType<typeof affiliateClickStats>> = [];
  try {
    const db = getDb();
    [providers, clicks] = await Promise.all([
      listAffiliateProviders(db),
      affiliateClickStats(db, 30),
    ]);
  } catch {
    // optional
  }

  return (
    <>
      <AdminPageHeader
        title={t.monetization.heading}
        description={t.monetization.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        <p>
          {t.monetization.killSwitch}:{" "}
          <span className="font-medium text-foreground">
            FEATURE_MONETIZATION=
            {env.FEATURE_MONETIZATION === "true" ? "true" : "false"}
          </span>
        </p>
        <p className="mt-1">{t.monetization.invariantHint}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel title={t.monetization.providersHeading}>
          {providers.length === 0 ? (
            <AdminEmptyState message={t.monetization.emptyProviders} />
          ) : (
            <ul className="divide-y divide-border/60 text-[0.8125rem]">
              {providers.map((provider) => (
                <li
                  key={provider.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">{provider.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider.providerKey} · {provider.providerType}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {provider.enabled
                      ? t.monetization.enabled
                      : t.monetization.disabled}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel title={t.monetization.clicksHeading}>
          {clicks.length === 0 ? (
            <AdminEmptyState message={t.monetization.emptyClicks} />
          ) : (
            <ul className="divide-y divide-border/60 text-[0.8125rem]">
              {clicks.map((row) => (
                <li
                  key={`${row.providerKey}-${row.placementKey}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div>
                    <p className="font-medium">{row.providerKey}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.placementKey}
                    </p>
                  </div>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
