import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { getDb } from "@/db";
import {
  listTopClickedCategories,
  listTopClickedCourses,
  listTopClickedProviders,
} from "@/db/repositories/outbound-click-repository";
import { summarizeApiUsage } from "@/domain/admin/api-usage";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let topCourses: Awaited<ReturnType<typeof listTopClickedCourses>> = [];
  let topProviders: Awaited<ReturnType<typeof listTopClickedProviders>> = [];
  let topCategories: Awaited<ReturnType<typeof listTopClickedCategories>> = [];
  let apiUsage: Awaited<ReturnType<typeof summarizeApiUsage>> = [];

  try {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    [topCourses, topProviders, topCategories, apiUsage] = await Promise.all([
      listTopClickedCourses(db),
      listTopClickedProviders(db),
      listTopClickedCategories(db),
      summarizeApiUsage(db, since),
    ]);
  } catch {
    // DB optional for page render
  }

  return (
    <>
      <AdminPageHeader
        title={t.analytics.outboundAnalytics}
        description={t.analytics.description}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <AnalyticsList
          title={t.analytics.topClickedCourses}
          emptyLabel={t.analytics.noClicks}
          items={topCourses.map((item) => ({
            id: item.courseId,
            label: item.title,
            href: `/course/${item.slug}`,
            value: item.clicks,
          }))}
        />
        <AnalyticsList
          title={t.analytics.topProviders}
          emptyLabel={t.analytics.noClicks}
          items={topProviders.map((item) => ({
            id: item.providerId,
            label: item.name,
            value: item.clicks,
          }))}
        />
        <AnalyticsList
          title={t.analytics.topCategories}
          emptyLabel={t.analytics.noClicks}
          items={topCategories.map((item) => ({
            id: item.categoryId,
            label: item.name,
            href: `/category/${item.slug}`,
            value: item.clicks,
          }))}
        />
      </div>

      <AdminPanel
        title={t.analytics.apiUsage}
        description={t.analytics.apiUsageDescription}
        className="mt-4"
        flush
      >
        {apiUsage.length === 0 ? (
          <AdminEmptyState message={t.analytics.noApiUsage} />
        ) : (
          <AdminTable caption={t.analytics.apiUsage}>
            <thead>
              <tr>
                <AdminTh>{t.analytics.period}</AdminTh>
                <AdminTh>{t.analytics.apiCalls}</AdminTh>
                <AdminTh>{t.analytics.apiFailures}</AdminTh>
                <AdminTh>{t.analytics.apiAvgLatency}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {apiUsage.map((row) => (
                <AdminTr key={`${row.kind}:${row.provider ?? "-"}`}>
                  <AdminTd>
                    <p className="font-medium">{row.kind}</p>
                    {row.provider ? (
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {row.provider}
                      </p>
                    ) : null}
                  </AdminTd>
                  <AdminTd className="tabular-nums">{row.calls}</AdminTd>
                  <AdminTd className="tabular-nums">{row.failures}</AdminTd>
                  <AdminTd className="tabular-nums">
                    {row.avgLatencyMs == null ? "—" : `${row.avgLatencyMs} ms`}
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
    </>
  );
}

function AnalyticsList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ id: string; label: string; value: number; href?: string }>;
}) {
  return (
    <AdminPanel title={title} flush>
      {items.length === 0 ? (
        <AdminEmptyState message={emptyLabel} />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2 text-[0.8125rem] transition hover:bg-muted/40"
            >
              {item.href ? (
                <Link href={item.href} className="min-w-0 hover:text-primary">
                  {item.label}
                </Link>
              ) : (
                <span className="min-w-0">{item.label}</span>
              )}
              <span className="shrink-0 font-medium tabular-nums">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}
