import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

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
import { MediaQualityActions } from "@/components/admin/media-quality-actions";
import { courses } from "@/db/schema";
import type { CourseImageSourceType, CourseImageStatus } from "@/domain/course/types";
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

const IMAGE_SOURCES = new Set<CourseImageSourceType>([
  "OFFICIAL",
  "TRUSTED_METADATA",
  "ADMIN_OVERRIDE",
  "CATEGORY_FALLBACK",
  "PROVIDER_FALLBACK",
]);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function AdminMediaQualityPage({
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;
  const statusRaw = first(params.status);
  const sourceRaw = first(params.source);
  const filter =
    statusRaw && IMAGE_STATUSES.has(statusRaw as CourseImageStatus)
      ? (statusRaw as CourseImageStatus)
      : undefined;
  const sourceFilter =
    sourceRaw && IMAGE_SOURCES.has(sourceRaw as CourseImageSourceType)
      ? (sourceRaw as CourseImageSourceType)
      : undefined;

  const { counts, rows, adminOverride } = await withDb(
    "admin.mediaQuality",
    async (db) => {
      const statusRows = await db
        .select({
          imageStatus: courses.imageStatus,
          imageSourceType: courses.imageSourceType,
        })
        .from(courses);

      const conditions = [];
      if (filter) conditions.push(eq(courses.imageStatus, filter));
      if (sourceFilter) conditions.push(eq(courses.imageSourceType, sourceFilter));

      const listQuery = db
        .select({
          id: courses.id,
          slug: courses.slug,
          title: courses.title,
          imageStatus: courses.imageStatus,
          imageSourceType: courses.imageSourceType,
          imageFallbackReason: courses.imageFallbackReason,
          imageOverrideUrl: courses.imageOverrideUrl,
        })
        .from(courses)
        .orderBy(desc(courses.updatedAt))
        .limit(80);

      const list =
        conditions.length > 0
          ? await listQuery.where(and(...conditions))
          : await listQuery;

      return {
        counts: summarizeMediaQuality(statusRows),
        adminOverride: statusRows.filter((r) => r.imageSourceType === "ADMIN_OVERRIDE")
          .length,
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
      adminOverride: 0,
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
      active: !filter && !sourceFilter,
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
      key: "OFFICIAL",
      label: t.mediaQuality.filterOfficial,
      href: "/admin/media-quality?source=OFFICIAL",
      active: sourceFilter === "OFFICIAL",
    },
    {
      key: "TRUSTED_METADATA",
      label: t.mediaQuality.filterMetadata,
      href: "/admin/media-quality?source=TRUSTED_METADATA",
      active: sourceFilter === "TRUSTED_METADATA",
    },
    {
      key: "ADMIN_OVERRIDE",
      label: t.mediaQuality.filterAdmin,
      href: "/admin/media-quality?source=ADMIN_OVERRIDE",
      active: sourceFilter === "ADMIN_OVERRIDE",
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
            label={t.mediaQuality.adminOverride}
            value={adminOverride}
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

      <AdminPanel title={filter ?? sourceFilter ?? t.mediaQuality.filterAll}>
        {rows.length === 0 ? (
          <AdminEmptyState message={t.mediaQuality.empty} />
        ) : (
          <AdminTable caption={t.mediaQuality.heading}>
            <thead>
              <AdminTr>
                <AdminTh>{t.mediaQuality.course}</AdminTh>
                <AdminTh>{t.mediaQuality.status}</AdminTh>
                <AdminTh>{t.mediaQuality.sourceType}</AdminTh>
                <AdminTh>{t.common.actions}</AdminTh>
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
                  <AdminTd>
                    <MediaQualityActions
                      courseId={row.id}
                      hasOverride={Boolean(row.imageOverrideUrl)}
                    />
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
