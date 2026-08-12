"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Category, Provider } from "@/db/schema";
import {
  CERTIFICATE_TYPE_LABELS,
  COURSE_STATUS_LABELS,
  PRICE_TYPE_LABELS,
} from "@/domain/course/labels";
import { slugify } from "@/lib/slug";

type CourseFormProps = {
  mode: "create" | "edit";
  courseId?: string;
  providers: Provider[];
  categories: Category[];
  initialValues?: {
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    providerId: string;
    categoryIds: string[];
    canonicalUrl: string;
    outboundUrl: string;
    affiliateUrl: string;
    instructor: string;
    language: string;
    level: string;
    durationMinutes: string;
    priceType: string;
    certificateType: string;
    qualityScore: string;
    editorScore: string;
    status: string;
  };
};

const defaultValues = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  providerId: "",
  categoryIds: [] as string[],
  canonicalUrl: "",
  outboundUrl: "",
  affiliateUrl: "",
  instructor: "",
  language: "English",
  level: "BEGINNER",
  durationMinutes: "",
  priceType: "FREE_FULL",
  certificateType: "UNKNOWN",
  qualityScore: "",
  editorScore: "",
  status: "DRAFT",
};

export function CourseForm({
  mode,
  courseId,
  providers,
  categories,
  initialValues,
}: CourseFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues ?? {
    ...defaultValues,
    providerId: providers[0]?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const selectedCategoryIds = useMemo(
    () => new Set(values.categoryIds),
    [values.categoryIds],
  );

  function updateField(field: string, value: string | string[]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleCategory(categoryId: string) {
    setValues((current) => {
      const next = new Set(current.categoryIds);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return { ...current, categoryIds: Array.from(next) };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        ...values,
        durationMinutes: values.durationMinutes
          ? Number(values.durationMinutes)
          : null,
        qualityScore: values.qualityScore ? Number(values.qualityScore) : null,
        editorScore: values.editorScore ? Number(values.editorScore) : null,
      };

      const response = await fetch(
        mode === "create"
          ? "/api/admin/courses"
          : `/api/admin/courses/${courseId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        course?: { id: string };
      };

      if (!response.ok) {
        setError(body.error ?? "Save failed");
        return;
      }

      if (mode === "create" && body.course?.id) {
        router.push(`/admin/courses/${body.course.id}`);
      } else {
        router.push("/admin/courses");
      }
      router.refresh();
    } catch {
      setError("Unable to save course");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            value={values.title}
            onChange={(event) => {
              const title = event.target.value;
              updateField("title", title);
              if (!slugTouched) {
                updateField("slug", slugify(title));
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            required
            value={values.slug}
            onChange={(event) => {
              setSlugTouched(true);
              updateField("slug", event.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="providerId">Provider</Label>
          <select
            id="providerId"
            required
            value={values.providerId}
            onChange={(event) => updateField("providerId", event.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="canonicalUrl">Canonical URL</Label>
          <Input
            id="canonicalUrl"
            type="url"
            required
            value={values.canonicalUrl}
            onChange={(event) => {
              updateField("canonicalUrl", event.target.value);
              if (!values.outboundUrl) {
                updateField("outboundUrl", event.target.value);
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="outboundUrl">Outbound URL</Label>
          <Input
            id="outboundUrl"
            type="url"
            value={values.outboundUrl}
            onChange={(event) => updateField("outboundUrl", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="affiliateUrl">Affiliate URL</Label>
          <Input
            id="affiliateUrl"
            type="url"
            value={values.affiliateUrl}
            onChange={(event) => updateField("affiliateUrl", event.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="shortDescription">Short description</Label>
          <Input
            id="shortDescription"
            value={values.shortDescription}
            onChange={(event) =>
              updateField("shortDescription", event.target.value)
            }
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={values.description}
            onChange={(event) => updateField("description", event.target.value)}
            className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructor">Instructor</Label>
          <Input
            id="instructor"
            value={values.instructor}
            onChange={(event) => updateField("instructor", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Input
            id="language"
            value={values.language}
            onChange={(event) => updateField("language", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <select
            id="level"
            value={values.level}
            onChange={(event) => updateField("level", event.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="ALL_LEVELS">All levels</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            type="number"
            min={1}
            value={values.durationMinutes}
            onChange={(event) =>
              updateField("durationMinutes", event.target.value)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceType">Price type</Label>
          <select
            id="priceType"
            value={values.priceType}
            onChange={(event) => updateField("priceType", event.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {(
              Object.entries(PRICE_TYPE_LABELS) as [
                keyof typeof PRICE_TYPE_LABELS,
                { label: string },
              ][]
            ).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="certificateType">Certificate</Label>
          <select
            id="certificateType"
            value={values.certificateType}
            onChange={(event) =>
              updateField("certificateType", event.target.value)
            }
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {(
              Object.entries(CERTIFICATE_TYPE_LABELS) as [
                keyof typeof CERTIFICATE_TYPE_LABELS,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qualityScore">Quality score</Label>
          <Input
            id="qualityScore"
            type="number"
            min={0}
            max={100}
            value={values.qualityScore}
            onChange={(event) => updateField("qualityScore", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="editorScore">Editor score</Label>
          <Input
            id="editorScore"
            type="number"
            min={0}
            max={100}
            value={values.editorScore}
            onChange={(event) => updateField("editorScore", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={values.status}
            onChange={(event) => updateField("status", event.target.value)}
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
          >
            {(
              Object.entries(COURSE_STATUS_LABELS) as [
                keyof typeof COURSE_STATUS_LABELS,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Categories</Label>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = selectedCategoryIds.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={
                  active
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
                }
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Create course"
              : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/courses")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
