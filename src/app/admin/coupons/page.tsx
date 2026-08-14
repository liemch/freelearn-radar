import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminMetric, AdminMetricRow } from "@/components/admin/admin-metric";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import {
  couponOpsSummary,
  listCouponCandidates,
  listCourseOffers,
} from "@/db/repositories/coupon-repository";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

const EMPTY_SUMMARY = {
  offers: {
    active100: 0,
    expired: 0,
    invalid: 0,
    unknown: 0,
    discovered: 0,
    total: 0,
  },
  sources: [] as Awaited<ReturnType<typeof couponOpsSummary>>["sources"],
  candidates: { total: 0, discovered: 0 },
};

export default async function AdminCouponsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const env = getServerEnv();

  const [ops, activeOffers, expiredOffers, candidates] = await Promise.all([
    withDb("admin.coupons.summary", (db) => couponOpsSummary(db), EMPTY_SUMMARY),
    withDb(
      "admin.coupons.active",
      (db) => listCourseOffers(db, { status: "ACTIVE_100_OFF", limit: 40 }),
      [],
    ),
    withDb(
      "admin.coupons.expired",
      (db) =>
        listCourseOffers(db, {
          status: ["EXPIRED", "INVALID"],
          limit: 40,
        }),
      [],
    ),
    withDb(
      "admin.coupons.candidates",
      (db) => listCouponCandidates(db, { status: "DISCOVERED", limit: 40 }),
      [],
    ),
  ]);

  const n = (value: number | string | null | undefined) => Number(value ?? 0);

  return (
    <>
      <AdminPageHeader
        title={t.coupons.heading}
        description={t.coupons.description}
      />

      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        <p>
          {t.coupons.killSwitch}:{" "}
          <span className="font-medium text-foreground">
            FEATURE_COUPON_DISCOVERY=
            {env.FEATURE_COUPON_DISCOVERY === "true" ? "true" : "false"}
          </span>
        </p>
      </div>

      <AdminPanel title={t.coupons.metricsHeading} className="mb-4">
        <AdminMetricRow>
          <AdminMetric
            label={t.coupons.active100}
            value={n(ops.offers.active100)}
            tone="positive"
          />
          <AdminMetric
            label={t.coupons.expired}
            value={n(ops.offers.expired)}
            tone="attention"
          />
          <AdminMetric
            label={t.coupons.invalid}
            value={n(ops.offers.invalid)}
          />
          <AdminMetric
            label={t.coupons.unknown}
            value={n(ops.offers.unknown)}
            tone="attention"
          />
          <AdminMetric
            label={t.coupons.discovered}
            value={n(ops.candidates.discovered)}
          />
        </AdminMetricRow>
      </AdminPanel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminPanel title={t.coupons.sourcesHeading}>
          {ops.sources.length === 0 ? (
            <AdminEmptyState message={t.coupons.emptySources} />
          ) : (
            <AdminTable caption={t.coupons.sourcesHeading}>
              <thead>
                <AdminTr>
                  <AdminTh>Source</AdminTh>
                  <AdminTh>Health</AdminTh>
                  <AdminTh numeric>Priority</AdminTh>
                  <AdminTh>State</AdminTh>
                </AdminTr>
              </thead>
              <tbody>
                {ops.sources.map((source) => (
                  <AdminTr key={source.id}>
                    <AdminTd>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.sourceKey}
                        {source.discoveryOnly
                          ? ` · ${t.coupons.discoveryOnly}`
                          : ""}
                      </p>
                    </AdminTd>
                    <AdminTd>{source.healthStatus}</AdminTd>
                    <AdminTd numeric>{source.priority}</AdminTd>
                    <AdminTd>
                      {source.enabled
                        ? t.coupons.enabled
                        : t.coupons.disabled}
                    </AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel title={t.coupons.candidatesHeading}>
          {candidates.length === 0 ? (
            <AdminEmptyState message={t.coupons.emptyCandidates} />
          ) : (
            <AdminTable caption={t.coupons.candidatesHeading}>
              <thead>
                <AdminTr>
                  <AdminTh>Offer</AdminTh>
                  <AdminTh>Code</AdminTh>
                  <AdminTh>From</AdminTh>
                </AdminTr>
              </thead>
              <tbody>
                {candidates.map((row) => (
                  <AdminTr key={row.id}>
                    <AdminTd>
                      <p className="max-w-[18rem] truncate font-medium">
                        {row.canonicalUrl || row.offerUrl}
                      </p>
                    </AdminTd>
                    <AdminTd>{row.couponCode ?? "—"}</AdminTd>
                    <AdminTd>{row.discoveredFrom ?? "—"}</AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel title={t.coupons.activeOffersHeading}>
          {activeOffers.length === 0 ? (
            <AdminEmptyState message={t.coupons.emptyOffers} />
          ) : (
            <AdminTable caption={t.coupons.activeOffersHeading}>
              <thead>
                <AdminTr>
                  <AdminTh>Offer URL</AdminTh>
                  <AdminTh>Code</AdminTh>
                  <AdminTh>Status</AdminTh>
                </AdminTr>
              </thead>
              <tbody>
                {activeOffers.map((offer) => (
                  <AdminTr key={offer.id}>
                    <AdminTd>
                      <p className="max-w-[18rem] truncate">{offer.offerUrl}</p>
                    </AdminTd>
                    <AdminTd>{offer.couponCode ?? "—"}</AdminTd>
                    <AdminTd>{offer.status}</AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>

        <AdminPanel title={t.coupons.expiredOffersHeading}>
          {expiredOffers.length === 0 ? (
            <AdminEmptyState message={t.coupons.emptyOffers} />
          ) : (
            <AdminTable caption={t.coupons.expiredOffersHeading}>
              <thead>
                <AdminTr>
                  <AdminTh>Offer URL</AdminTh>
                  <AdminTh>Code</AdminTh>
                  <AdminTh>Status</AdminTh>
                </AdminTr>
              </thead>
              <tbody>
                {expiredOffers.map((offer) => (
                  <AdminTr key={offer.id}>
                    <AdminTd>
                      <p className="max-w-[18rem] truncate">{offer.offerUrl}</p>
                    </AdminTd>
                    <AdminTd>{offer.couponCode ?? "—"}</AdminTd>
                    <AdminTd>{offer.status}</AdminTd>
                  </AdminTr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
