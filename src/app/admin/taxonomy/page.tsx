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
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listAllTopicTags } from "@/domain/taxonomy/topic-tags";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminTaxonomyPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  // EDITOR and ADMIN can view (read-only).
  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    redirect("/admin");
  }

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let tags: Awaited<ReturnType<typeof listAllTopicTags>> = [];
  try {
    tags = await listAllTopicTags(getDb());
  } catch {
    tags = [];
  }

  return (
    <>
      <AdminPageHeader
        title={t.taxonomy.heading}
        description={t.taxonomy.description}
      />

      <AdminPanel
        title={t.taxonomy.heading}
        description={t.taxonomy.readOnlyNote}
        actions={<Badge variant="outline">{tags.length}</Badge>}
        flush
      >
        {tags.length === 0 ? (
          <AdminEmptyState message={t.taxonomy.empty} />
        ) : (
          <AdminTable caption={t.taxonomy.heading}>
            <thead>
              <tr>
                <AdminTh>{t.taxonomy.slug}</AdminTh>
                <AdminTh>{t.taxonomy.nameEn}</AdminTh>
                <AdminTh>{t.taxonomy.nameVi}</AdminTh>
                <AdminTh numeric>{t.taxonomy.courseCount}</AdminTh>
                <AdminTh>{t.taxonomy.active}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <AdminTr key={tag.id}>
                  <AdminTd className="whitespace-nowrap font-mono text-[0.6875rem]">
                    {tag.slug}
                  </AdminTd>
                  <AdminTd>{tag.nameEn}</AdminTd>
                  <AdminTd>{tag.nameVi}</AdminTd>
                  <AdminTd numeric>{tag.courseCount}</AdminTd>
                  <AdminTd className="whitespace-nowrap text-muted-foreground">
                    {tag.active ? t.common.yes : t.common.no}
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
