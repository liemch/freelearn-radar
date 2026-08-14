import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
      <AdminPageHeader title={t.taxonomy.heading} />

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.taxonomy.description}</p>
        <p className="text-xs text-muted-foreground">{t.taxonomy.readOnlyNote}</p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{t.taxonomy.heading}</caption>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.taxonomy.slug}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.taxonomy.nameEn}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t.taxonomy.nameVi}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.taxonomy.courseCount}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {t.taxonomy.active}
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-b border-border/60">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {tag.slug}
                  </td>
                  <td className="px-4 py-3">{tag.nameEn}</td>
                  <td className="px-4 py-3">{tag.nameVi}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {tag.courseCount}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {tag.active ? t.common.yes : t.common.no}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tags.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t.taxonomy.empty}
          </p>
        ) : null}
      </div>
    </>
  );
}
