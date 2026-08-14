import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.nav.taxonomy}
            </p>
            <h1 className="text-xl font-semibold">{t.taxonomy.heading}</h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <p className="text-sm text-muted-foreground">{t.taxonomy.description}</p>
        <p className="text-xs text-muted-foreground">{t.taxonomy.readOnlyNote}</p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">{t.taxonomy.slug}</th>
                <th className="px-4 py-3 font-medium">{t.taxonomy.nameEn}</th>
                <th className="px-4 py-3 font-medium">{t.taxonomy.nameVi}</th>
                <th className="px-4 py-3 font-medium">{t.taxonomy.courseCount}</th>
                <th className="px-4 py-3 font-medium">{t.taxonomy.active}</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-mono text-xs">{tag.slug}</td>
                  <td className="px-4 py-3">{tag.nameEn}</td>
                  <td className="px-4 py-3">{tag.nameVi}</td>
                  <td className="px-4 py-3">{tag.courseCount}</td>
                  <td className="px-4 py-3">
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
      </main>
    </div>
  );
}
