import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

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
import { courses } from "@/db/schema";
import type { CourseImageStatus } from "@/domain/course/types";
import { summarizeMediaQuality } from "@/domain/media/media-resolver";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const IMAGE_STATUSES = new Set<CourseImageStatus>([
  "OK",
  "MISSING",
  "BROKEN",
  "FALLBACK",
  "BLOCKED",
  "PENDING",
]);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseStatus(
  raw: string | string[] | undefined,
): CourseImageStatus | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && IMAGE_STATUSES.has(value as CourseImageStatus)) {
    return value as CourseImageStatus;
  }
  return undefined;
}

export default async function AdminMediaQualityPage({
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;
  const filter = parseStatus(params.status);

  const { counts, rows } = await withDb(
    "admin.mediaQuality",
    async (db) => {
      const statusRows = await db
        .select({
          imageStatus: courses.imageStatus,
          imageSourceType: courses.imageSourceType,
        })
        .from(courses);

      const list = filter
        ? await db
            .select({
              id: courses.id,
              slug: courses.slug,
              title: courses.title,
              imageStatus: courses.imageStatus,
              imageSourceType: courses.imageSourceType,
              imageFallbackReason: courses.imageFallbackReason,
            })
            .from(courses)
            .where(eq(courses.imageStatus, filter))
            .orderBy(desc(courses.updatedAt))
            .limit(80)
        : await db
            .select({
              id: courses.id,
              slug: courses.slug,
              title: courses.title,
              imageStatus: courses.imageStatus,
              imageSourceType: courses.imageSourceType,
              imageFallbackReason: courses.imageFallbackReason,
            })
            .from(courses)
            .orderBy(desc(courses.updatedAt))
            .limit(80);

      return {
        counts: summarizeMediaQuality(statusRows),
        rows: list,
      };
    },
    {
      counts: {
        total: 0,
        withThumbnail: 0,
        official: 0,
        fallback: 0,
        broken: 0,
        missing: 0,
        blocked: 0,
      },
      rows: [],
    },
  );

  const filters: Array<{
    key: string;
    label: string;
    href: string;
    active: boolean;
  }> = [
    {
      key: "all",
      label: t.mediaQuality.filterAll,
      href: "/admin/media-quality",
      active: !filter,
    },
    {
      key: "MISSING",
      label: t.mediaQuality.filterMissing,
      href: "/admin/media-quality?status=MISSING",
      active: filter === "MISSING",
    },
    {
      key: "BROKEN",
      label: t.mediaQuality.filterBroken,
      href: "/admin/media-quality?status=BROKEN",
      active: filter === "BROKEN",
    },
    {
      key: "FALLBACK",
      label: t.mediaQuality.filterFallback,
      href: "/admin/media-quality?status=FALLBACK",
      active: filter === "FALLBACK",
    },
    {
      key: "BLOCKED",
      label: t.mediaQuality.filterBlocked,
      href: "/admin/media-quality?status=BLOCKED",
      active: filter === "BLOCKED",
    },
    {
      key: "OK",
      label: t.mediaQuality.filterOk,
      href: "/admin/media-quality?status=OK",
      active: filter === "OK",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={t.mediaQuality.heading}
        description={t.mediaQuality.description}
      />

      <AdminPanel title={t.mediaQuality.heading} className="mb-4">
        <AdminMetricRow>
          <AdminMetric label={t.mediaQuality.total} value={counts.total} />
          <AdminMetric
            label={t.mediaQuality.withThumbnail}
            value={counts.withThumbnail}
            tone="positive"
          />
          <AdminMetric
            label={t.mediaQuality.official}
            value={counts.official}
          />
          <AdminMetric
            label={t.mediaQuality.missing}
            value={counts.missing}
            tone="attention"
          />
          <AdminMetric
            label={t.mediaQuality.broken}
            value={counts.broken}
            tone="critical"
          />
          <AdminMetric
            label={t.mediaQuality.fallback}
            value={counts.fallback}
            tone="attention"
          />
          <AdminMetric
            label={t.mediaQuality.blocked}
            value={counts.blocked}
          />
        </AdminMetricRow>
      </AdminPanel>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded border px-2.5 py-1 text-[0.75rem] transition",
              item.active
                ? "border-foreground/30 bg-muted font-medium text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <AdminPanel title={filter ?? t.mediaQuality.filterAll}>
        {rows.length === 0 ? (
          <AdminEmptyState message={t.mediaQuality.empty} />
        ) : (
          <AdminTable caption={t.mediaQuality.heading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.mediaQuality.course}</AdminTh>
                <AdminTh>{t.mediaQuality.status}</AdminTh>
                <AdminTh>{t.mediaQuality.sourceType}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AdminTr key={row.id}>
                  <AdminTd>
                    <Link
                      href={`/admin/courses/${row.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {row.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.slug}</p>
                  </AdminTd>
                  <AdminTd>{row.imageStatus}</AdminTd>
                  <AdminTd>
                    <span>{row.imageSourceType}</span>
                    {row.imageFallbackReason ? (
                      <p className="text-xs text-muted-foreground">
                        {row.imageFallbackReason}
                      </p>
                    ) : null}
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
