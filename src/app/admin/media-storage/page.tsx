import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
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
import { managedAssets } from "@/db/schema/managed-assets";
import type { ManagedAssetStatus, ManagedAssetType } from "@/db/schema/managed-assets";
import { isObjectStorageEnabled } from "@/domain/storage/get-provider";
import { withDb } from "@/lib/db-safe";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPES = new Set<ManagedAssetType>([
  "BRANDING",
  "COURSE_OVERRIDE",
  "COURSE_CACHE",
  "AFFILIATE_PRODUCT",
  "FALLBACK",
  "OTHER",
]);

const STATUSES = new Set<ManagedAssetStatus>([
  "ACTIVE",
  "UNREFERENCED",
  "PENDING_DELETE",
  "DELETED",
  "ERROR",
]);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminMediaStoragePage({
  searchParams,
}: PageProps) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const params = await searchParams;
  const typeRaw = first(params.type);
  const statusRaw = first(params.status);
  const typeFilter =
    typeRaw && TYPES.has(typeRaw as ManagedAssetType)
      ? (typeRaw as ManagedAssetType)
      : undefined;
  const statusFilter =
    statusRaw && STATUSES.has(statusRaw as ManagedAssetStatus)
      ? (statusRaw as ManagedAssetStatus)
      : undefined;

  const data = await withDb(
    "admin.mediaStorage",
    async (db) => {
      const aggregates = await db
        .select({
          assetType: managedAssets.assetType,
          status: managedAssets.status,
          count: sql<number>`count(*)::int`,
          bytes: sql<number>`coalesce(sum(${managedAssets.sizeBytes}), 0)::int`,
        })
        .from(managedAssets)
        .groupBy(managedAssets.assetType, managedAssets.status);

      const conditions = [];
      if (typeFilter) conditions.push(eq(managedAssets.assetType, typeFilter));
      if (statusFilter) conditions.push(eq(managedAssets.status, statusFilter));

      const listQuery = db
        .select({
          id: managedAssets.id,
          assetType: managedAssets.assetType,
          storageProvider: managedAssets.storageProvider,
          storageKey: managedAssets.storageKey,
          mimeType: managedAssets.mimeType,
          sizeBytes: managedAssets.sizeBytes,
          status: managedAssets.status,
          contentHash: managedAssets.contentHash,
          createdAt: managedAssets.createdAt,
          unreferencedAt: managedAssets.unreferencedAt,
        })
        .from(managedAssets)
        .orderBy(desc(managedAssets.updatedAt))
        .limit(100);

      const rows =
        conditions.length > 0
          ? await listQuery.where(and(...conditions))
          : await listQuery;

      return { aggregates, rows };
    },
    { aggregates: [], rows: [] },
  );

  const totalObjects = data.aggregates.reduce((sum, row) => sum + row.count, 0);
  const totalBytes = data.aggregates.reduce((sum, row) => sum + row.bytes, 0);
  const orphanCount = data.aggregates
    .filter((row) => row.status === "UNREFERENCED")
    .reduce((sum, row) => sum + row.count, 0);
  const failedCount = data.aggregates
    .filter((row) => row.status === "ERROR")
    .reduce((sum, row) => sum + row.count, 0);

  const byType = (type: ManagedAssetType) =>
    data.aggregates
      .filter((row) => row.assetType === type && row.status === "ACTIVE")
      .reduce(
        (acc, row) => ({
          count: acc.count + row.count,
          bytes: acc.bytes + row.bytes,
        }),
        { count: 0, bytes: 0 },
      );

  const filters = [
    { key: "all", label: t.mediaStorage.filterAll, href: "/admin/media-storage", active: !typeFilter && !statusFilter },
    { key: "BRANDING", label: t.mediaStorage.typeBranding, href: "/admin/media-storage?type=BRANDING", active: typeFilter === "BRANDING" },
    { key: "COURSE_OVERRIDE", label: t.mediaStorage.typeCourseOverride, href: "/admin/media-storage?type=COURSE_OVERRIDE", active: typeFilter === "COURSE_OVERRIDE" },
    { key: "COURSE_CACHE", label: t.mediaStorage.typeCourseCache, href: "/admin/media-storage?type=COURSE_CACHE", active: typeFilter === "COURSE_CACHE" },
    { key: "AFFILIATE_PRODUCT", label: t.mediaStorage.typeAffiliate, href: "/admin/media-storage?type=AFFILIATE_PRODUCT", active: typeFilter === "AFFILIATE_PRODUCT" },
    { key: "UNREFERENCED", label: t.mediaStorage.filterOrphan, href: "/admin/media-storage?status=UNREFERENCED", active: statusFilter === "UNREFERENCED" },
    { key: "ERROR", label: t.mediaStorage.filterFailed, href: "/admin/media-storage?status=ERROR", active: statusFilter === "ERROR" },
  ];

  return (
    <>
      <AdminPageHeader
        title={t.mediaStorage.heading}
        description={t.mediaStorage.description}
        meta={
          <span className="text-xs text-muted-foreground">
            {isObjectStorageEnabled()
              ? t.mediaStorage.storageOn
              : t.mediaStorage.storageOff}
          </span>
        }
      />

      <AdminPanel title={t.mediaStorage.heading} className="mb-4">
        <AdminMetricRow>
          <AdminMetric label={t.mediaStorage.totalAssets} value={totalObjects} />
          <AdminMetric
            label={t.mediaStorage.totalBytes}
            value={formatBytes(totalBytes)}
          />
          <AdminMetric
            label={t.mediaStorage.typeBranding}
            value={byType("BRANDING").count}
          />
          <AdminMetric
            label={t.mediaStorage.typeCourseOverride}
            value={byType("COURSE_OVERRIDE").count}
          />
          <AdminMetric
            label={t.mediaStorage.typeCourseCache}
            value={byType("COURSE_CACHE").count}
          />
          <AdminMetric
            label={t.mediaStorage.typeAffiliate}
            value={byType("AFFILIATE_PRODUCT").count}
          />
          <AdminMetric
            label={t.mediaStorage.orphans}
            value={orphanCount}
            tone="attention"
          />
          <AdminMetric
            label={t.mediaStorage.failed}
            value={failedCount}
            tone="critical"
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

      <AdminPanel title={t.mediaStorage.listTitle}>
        {data.rows.length === 0 ? (
          <AdminEmptyState message={t.mediaStorage.empty} />
        ) : (
          <AdminTable caption={t.mediaStorage.listTitle}>
            <thead>
              <AdminTr>
                <AdminTh>{t.mediaStorage.colType}</AdminTh>
                <AdminTh>{t.mediaStorage.colStatus}</AdminTh>
                <AdminTh>{t.mediaStorage.colSize}</AdminTh>
                <AdminTh>{t.mediaStorage.colKey}</AdminTh>
              </AdminTr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <AdminTr key={row.id}>
                  <AdminTd>{row.assetType}</AdminTd>
                  <AdminTd>{row.status}</AdminTd>
                  <AdminTd>{formatBytes(row.sizeBytes)}</AdminTd>
                  <AdminTd>
                    <span className="font-mono text-xs break-all">
                      {row.storageProvider}:{row.storageKey}
                    </span>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {row.mimeType} · {row.contentHash.slice(0, 12)}…
                    </p>
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
