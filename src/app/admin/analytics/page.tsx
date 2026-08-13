import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
import { getDb } from "@/db";
import {
  listTopClickedCategories,
  listTopClickedCourses,
  listTopClickedProviders,
} from "@/db/repositories/outbound-click-repository";
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

  try {
    const db = getDb();
    [topCourses, topProviders, topCategories] = await Promise.all([
      listTopClickedCourses(db),
      listTopClickedProviders(db),
      listTopClickedCategories(db),
    ]);
  } catch {
    // DB optional for page render
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.analytics.heading}
            </p>
            <h1 className="text-xl font-semibold">
              {t.analytics.outboundAnalytics}
            </h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
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
      </main>
    </div>
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
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            {item.href ? (
              <Link href={item.href} className="hover:text-primary">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
            <span className="font-medium">{item.value}</span>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-sm text-muted-foreground">{emptyLabel}</li>
        ) : null}
      </ul>
    </section>
  );
}
