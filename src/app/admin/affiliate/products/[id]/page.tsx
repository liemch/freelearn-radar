import { notFound, redirect } from "next/navigation";

import { AffiliateProductForm } from "@/components/admin/affiliate-product-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { getDb } from "@/db";
import {
  findAffiliateProductById,
  listAffiliateProductContexts,
} from "@/db/repositories/affiliate-product-repository";
import { listAffiliateProviders } from "@/db/repositories/affiliate-repository";
import { listCourses } from "@/db/repositories/course-repository";
import { PLACEMENT_KEYS } from "@/domain/affiliate/resolve-placements";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

function dateTimeLocal(value: Date | null) {
  if (!value) return "";
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default async function AffiliateProductDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;
  const db = getDb();
  const [row, contexts, providers, courseRows] = await Promise.all([
    findAffiliateProductById(db, id),
    listAffiliateProductContexts(db, id),
    listAffiliateProviders(db),
    listCourses(db, { limit: 300 }),
  ]);
  if (!row) notFound();

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale).affiliateProducts;
  const product = row.product;

  return (
    <>
      <AdminPageHeader title={product.title} description={t.description} />
      <AdminPanel>
        <AffiliateProductForm
          mode="edit"
          productId={product.id}
          providers={providers}
          courses={courseRows.map(({ id, title, slug }) => ({ id, title, slug }))}
          contexts={contexts}
          placementKeys={Object.values(PLACEMENT_KEYS)}
          labels={{
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
          }}
          initialValues={{
            merchant: product.merchant,
            title: product.title,
            destinationUrl: product.destinationUrl,
            imageUrl: product.imageUrl ?? "",
            shortDescription: product.shortDescription ?? "",
            productCategory: product.productCategory,
            displayPrice: product.displayPrice ?? "",
            originalPrice: product.originalPrice ?? "",
            currency: product.currency ?? "VND",
            discountLabel: product.discountLabel ?? "",
            shopName: product.shopName ?? "",
            merchantProductId: product.merchantProductId ?? "",
            status: product.status,
            startsAt: dateTimeLocal(product.startsAt),
            endsAt: dateTimeLocal(product.endsAt),
            affiliateProviderId: product.affiliateProviderId ?? "",
          }}
        />
      </AdminPanel>
    </>
  );
}
