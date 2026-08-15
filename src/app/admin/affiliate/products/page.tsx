import Link from "next/link";
import { redirect } from "next/navigation";

import { AffiliateProductForm } from "@/components/admin/affiliate-product-form";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { getDb } from "@/db";
import { listAffiliateProducts } from "@/db/repositories/affiliate-product-repository";
import { listAffiliateProviders } from "@/db/repositories/affiliate-repository";
import { listCourses } from "@/db/repositories/course-repository";
import { PLACEMENT_KEYS } from "@/domain/affiliate/resolve-placements";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AffiliateProductsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale).affiliateProducts;
  const db = getDb();
  const [products, providers, courseRows] = await Promise.all([
    listAffiliateProducts(db),
    listAffiliateProviders(db),
    listCourses(db, { limit: 300 }),
  ]);
  const labels = {
    save: t.save,
    saving: t.saving,
    create: t.create,
    delete: t.delete,
    addContext: t.addContext,
    productFields: t.productFields,
    contextHeading: t.contextHeading,
    courseSearch: t.courseSearch,
    noCourse: t.noCourse,
    error: t.error,
  };

  return (
    <>
      <AdminPageHeader title={t.heading} description={t.description} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
        <AdminPanel title={t.listHeading}>
          {products.length === 0 ? (
            <AdminEmptyState message={t.empty} />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/affiliate/products/${product.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                  >
                    <span>
                      <span className="block font-medium">{product.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {product.merchant} · {product.productCategory}
                      </span>
                    </span>
                    <span className="text-xs">{product.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
        <AdminPanel title={t.createHeading}>
          <AffiliateProductForm
            mode="create"
            providers={providers}
            courses={courseRows.map(({ id, title, slug }) => ({ id, title, slug }))}
            placementKeys={Object.values(PLACEMENT_KEYS)}
            labels={labels}
          />
        </AdminPanel>
      </div>
    </>
  );
}
