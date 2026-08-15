"use client";

import { useRouter } from "nextjs-toploader/app";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRODUCT_GROUPS = [
  "BOOK",
  "LAPTOP_TABLET",
  "MONITOR",
  "KEYBOARD_MOUSE",
  "HEADSET_WEBCAM_MIC",
  "LAPTOP_STAND",
  "DESK_LIGHT",
  "STUDY_ACCESSORY",
  "LAB_NETWORKING_DEVICE",
  "OTHER_LEARNING_RELATED",
] as const;

type ProductValues = {
  merchant: "SHOPEE" | "LAZADA";
  title: string;
  destinationUrl: string;
  imageUrl: string;
  shortDescription: string;
  productCategory: string;
  displayPrice: string;
  originalPrice: string;
  currency: string;
  discountLabel: string;
  shopName: string;
  merchantProductId: string;
  status: "ACTIVE" | "INACTIVE";
  startsAt: string;
  endsAt: string;
  affiliateProviderId: string;
};

type ContextRow = {
  context: {
    id: string;
    placementKey: string;
    topicSlug: string | null;
    categorySlug: string | null;
    priority: number;
    enabled: boolean;
  };
  courseTitle: string | null;
  courseSlug: string | null;
};

type Props = {
  mode: "create" | "edit";
  productId?: string;
  initialValues?: ProductValues;
  providers: Array<{ id: string; displayName: string }>;
  courses: Array<{ id: string; title: string; slug: string }>;
  contexts?: ContextRow[];
  placementKeys: string[];
  labels: {
    save: string;
    saving: string;
    create: string;
    delete: string;
    addContext: string;
    productFields: string;
    contextHeading: string;
    courseSearch: string;
    noCourse: string;
    error: string;
  };
};

const EMPTY: ProductValues = {
  merchant: "SHOPEE",
  title: "",
  destinationUrl: "",
  imageUrl: "",
  shortDescription: "",
  productCategory: "BOOK",
  displayPrice: "",
  originalPrice: "",
  currency: "VND",
  discountLabel: "",
  shopName: "",
  merchantProductId: "",
  status: "INACTIVE",
  startsAt: "",
  endsAt: "",
  affiliateProviderId: "",
};

export function AffiliateProductForm({
  mode,
  productId,
  initialValues,
  providers,
  courses,
  contexts = [],
  placementKeys,
  labels,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseQuery, setCourseQuery] = useState("");
  const [context, setContext] = useState({
    placementKey: placementKeys[0] ?? "",
    courseId: "",
    topicSlug: "",
    categorySlug: "",
    priority: "100",
    enabled: true,
  });

  const filteredCourses = useMemo(() => {
    const query = courseQuery.trim().toLowerCase();
    if (!query) return courses.slice(0, 50);
    return courses
      .filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.slug.toLowerCase().includes(query),
      )
      .slice(0, 50);
  }, [courseQuery, courses]);

  function field(name: keyof ProductValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        mode === "create"
          ? "/api/admin/affiliate/products"
          : `/api/admin/affiliate/products/${productId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...values,
            affiliateProviderId: values.affiliateProviderId || null,
            startsAt: values.startsAt
              ? new Date(values.startsAt).toISOString()
              : null,
            endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? labels.error);
      if (mode === "create") {
        router.push(`/admin/affiliate/products/${payload.product.id}`);
      } else {
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.error);
    } finally {
      setSaving(false);
    }
  }

  async function addContext(event: React.FormEvent) {
    event.preventDefault();
    if (!productId) return;
    setError(null);
    const response = await fetch(
      `/api/admin/affiliate/products/${productId}/contexts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...context,
          courseId: context.courseId || null,
          priority: Number(context.priority),
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? labels.error);
      return;
    }
    setContext((current) => ({
      ...current,
      courseId: "",
      topicSlug: "",
      categorySlug: "",
    }));
    router.refresh();
  }

  async function removeContext(contextId: string) {
    if (!productId) return;
    const response = await fetch(
      `/api/admin/affiliate/products/${productId}/contexts/${contextId}`,
      { method: "DELETE" },
    );
    if (response.ok) router.refresh();
  }

  async function removeProduct() {
    if (!productId || !window.confirm("Xóa sản phẩm affiliate này?")) return;
    const response = await fetch(`/api/admin/affiliate/products/${productId}`, {
      method: "DELETE",
    });
    if (response.ok) router.push("/admin/affiliate/products");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-sm font-semibold">{labels.productFields}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tên sản phẩm">
            <Input value={values.title} onChange={(e) => field("title", e.target.value)} required />
          </Field>
          <Field label="Nhà bán">
            <select className="h-9 w-full rounded border border-input bg-background px-3 text-sm" value={values.merchant} onChange={(e) => field("merchant", e.target.value)}>
              <option value="SHOPEE">Shopee</option>
              <option value="LAZADA">Lazada</option>
            </select>
          </Field>
          <Field label="URL affiliate HTTPS">
            <Input type="url" value={values.destinationUrl} onChange={(e) => field("destinationUrl", e.target.value)} required />
          </Field>
          <Field label="URL ảnh">
            <Input type="url" value={values.imageUrl} onChange={(e) => field("imageUrl", e.target.value)} />
          </Field>
          <Field label="Nhóm sản phẩm">
            <select className="h-9 w-full rounded border border-input bg-background px-3 text-sm" value={values.productCategory} onChange={(e) => field("productCategory", e.target.value)}>
              {PRODUCT_GROUPS.map((group) => <option key={group}>{group}</option>)}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select className="h-9 w-full rounded border border-input bg-background px-3 text-sm" value={values.status} onChange={(e) => field("status", e.target.value)}>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ACTIVE">ACTIVE</option>
            </select>
          </Field>
          <Field label="Giá hiển thị"><Input value={values.displayPrice} onChange={(e) => field("displayPrice", e.target.value)} /></Field>
          <Field label="Giá gốc"><Input value={values.originalPrice} onChange={(e) => field("originalPrice", e.target.value)} /></Field>
          <Field label="Nhãn giảm giá"><Input value={values.discountLabel} onChange={(e) => field("discountLabel", e.target.value)} /></Field>
          <Field label="Tên shop"><Input value={values.shopName} onChange={(e) => field("shopName", e.target.value)} /></Field>
          <Field label="Mã sản phẩm merchant"><Input value={values.merchantProductId} onChange={(e) => field("merchantProductId", e.target.value)} /></Field>
          <Field label="Nhà cung cấp tracking">
            <select className="h-9 w-full rounded border border-input bg-background px-3 text-sm" value={values.affiliateProviderId} onChange={(e) => field("affiliateProviderId", e.target.value)}>
              <option value="">Không chọn</option>
              {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}
            </select>
          </Field>
          <Field label="Bắt đầu"><Input type="datetime-local" value={values.startsAt} onChange={(e) => field("startsAt", e.target.value)} /></Field>
          <Field label="Kết thúc"><Input type="datetime-local" value={values.endsAt} onChange={(e) => field("endsAt", e.target.value)} /></Field>
        </div>
        <Field label="Mô tả ngắn">
          <textarea className="min-h-20 w-full rounded border border-input bg-background p-3 text-sm" value={values.shortDescription} onChange={(e) => field("shortDescription", e.target.value)} />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? labels.saving : mode === "create" ? labels.create : labels.save}</Button>
          {mode === "edit" ? <Button type="button" variant="destructive" onClick={removeProduct}>{labels.delete}</Button> : null}
        </div>
      </form>

      {mode === "edit" ? (
        <section className="space-y-3 border-t border-border pt-5">
          <h2 className="text-sm font-semibold">{labels.contextHeading}</h2>
          <ul className="space-y-2 text-sm">
            {contexts.map((row) => (
              <li key={row.context.id} className="flex items-center justify-between gap-3 rounded border border-border p-3">
                <span>{row.context.placementKey} · {row.courseTitle ?? row.context.topicSlug ?? row.context.categorySlug ?? "Toàn cục"} · ưu tiên {row.context.priority}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeContext(row.context.id)}>{labels.delete}</Button>
              </li>
            ))}
          </ul>
          <form onSubmit={addContext} className="grid gap-3 rounded border border-border p-3 md:grid-cols-2">
            <Field label="Placement">
              <select className="h-9 w-full rounded border border-input bg-background px-3 text-sm" value={context.placementKey} onChange={(e) => setContext({ ...context, placementKey: e.target.value })}>
                {placementKeys.map((key) => <option key={key}>{key}</option>)}
              </select>
            </Field>
            <Field label={labels.courseSearch}>
              <Input value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} placeholder="Nhập tên hoặc slug..." />
              <select className="mt-2 h-9 w-full rounded border border-input bg-background px-3 text-sm" value={context.courseId} onChange={(e) => setContext({ ...context, courseId: e.target.value })}>
                <option value="">{labels.noCourse}</option>
                {filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.title} · {course.slug}</option>)}
              </select>
            </Field>
            <Field label="Topic slug"><Input value={context.topicSlug} onChange={(e) => setContext({ ...context, topicSlug: e.target.value })} /></Field>
            <Field label="Category slug"><Input value={context.categorySlug} onChange={(e) => setContext({ ...context, categorySlug: e.target.value })} /></Field>
            <Field label="Ưu tiên biên tập (số nhỏ trước)"><Input type="number" min="0" value={context.priority} onChange={(e) => setContext({ ...context, priority: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={context.enabled} onChange={(e) => setContext({ ...context, enabled: e.target.checked })} /> Bật ngữ cảnh</label>
            <div><Button type="submit">{labels.addContext}</Button></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
