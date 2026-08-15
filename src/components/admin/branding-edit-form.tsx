"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SiteAssetKey } from "@/db/schema/site-branding";

type BrandingLabels = {
  brandHeading: string;
  brandDescription: string;
  homeHeading: string;
  homeDescription: string;
  logo: string;
  logoCompact: string;
  favicon: string;
  heroImage: string;
  upload: string;
  replace: string;
  restoreDefault: string;
  removeImage: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  searchPlaceholder: string;
  heroImageAlt: string;
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  uploadFailed: string;
  previewMissing: string;
  usingDefault: string;
};

type BrandingEditFormProps = {
  canWrite: boolean;
  initial: {
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
    searchPlaceholder: string;
    heroImageAlt: string;
    logoUrl: string | null;
    logoCompactUrl: string | null;
    faviconUrl: string | null;
    heroImageUrl: string | null;
  };
  labels: BrandingLabels;
};

type AssetSlot = {
  key: SiteAssetKey;
  label: string;
  url: string | null;
  accept: string;
};

export function BrandingEditForm({
  canWrite,
  initial,
  labels,
}: BrandingEditFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [heroEyebrow, setHeroEyebrow] = useState(initial.heroEyebrow);
  const [heroTitle, setHeroTitle] = useState(initial.heroTitle);
  const [heroDescription, setHeroDescription] = useState(
    initial.heroDescription,
  );
  const [searchPlaceholder, setSearchPlaceholder] = useState(
    initial.searchPlaceholder,
  );
  const [heroImageAlt, setHeroImageAlt] = useState(initial.heroImageAlt);

  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [logoCompactUrl, setLogoCompactUrl] = useState(initial.logoCompactUrl);
  const [faviconUrl, setFaviconUrl] = useState(initial.faviconUrl);
  const [heroImageUrl, setHeroImageUrl] = useState(initial.heroImageUrl);

  function applyUrls(payload: {
    logoUrl?: string | null;
    logoCompactUrl?: string | null;
    faviconUrl?: string | null;
    heroImageUrl?: string | null;
  }) {
    if ("logoUrl" in payload) setLogoUrl(payload.logoUrl ?? null);
    if ("logoCompactUrl" in payload)
      setLogoCompactUrl(payload.logoCompactUrl ?? null);
    if ("faviconUrl" in payload) setFaviconUrl(payload.faviconUrl ?? null);
    if ("heroImageUrl" in payload)
      setHeroImageUrl(payload.heroImageUrl ?? null);
  }

  async function saveText() {
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroEyebrow,
          heroTitle,
          heroDescription,
          searchPlaceholder,
          heroImageAlt,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        hero?: {
          eyebrow: string;
          title: string;
          description: string;
          searchPlaceholder: string;
          heroImageAlt: string;
        };
      };
      if (!response.ok) {
        setError(payload.error || labels.saveFailed);
        return;
      }
      if (payload.hero) {
        setHeroEyebrow(payload.hero.eyebrow);
        setHeroTitle(payload.hero.title);
        setHeroDescription(payload.hero.description);
        setSearchPlaceholder(payload.hero.searchPlaceholder);
        setHeroImageAlt(payload.hero.heroImageAlt);
      }
      setMessage(labels.saved);
      startTransition(() => router.refresh());
    } catch {
      setError(labels.saveFailed);
    }
  }

  async function uploadAsset(key: SiteAssetKey, file: File | null) {
    if (!file) return;
    setMessage(null);
    setError(null);
    const form = new FormData();
    form.set("key", key);
    form.set("action", "upload");
    form.set("file", file);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PATCH",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        logoUrl?: string | null;
        logoCompactUrl?: string | null;
        faviconUrl?: string | null;
        heroImageUrl?: string | null;
      };
      if (!response.ok) {
        setError(payload.error || labels.uploadFailed);
        return;
      }
      applyUrls(payload);
      setMessage(labels.saved);
      startTransition(() => router.refresh());
    } catch {
      setError(labels.uploadFailed);
    }
  }

  async function clearAsset(key: SiteAssetKey) {
    setMessage(null);
    setError(null);
    const form = new FormData();
    form.set("key", key);
    form.set("action", "clear");
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PATCH",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        logoUrl?: string | null;
        logoCompactUrl?: string | null;
        faviconUrl?: string | null;
        heroImageUrl?: string | null;
      };
      if (!response.ok) {
        setError(payload.error || labels.saveFailed);
        return;
      }
      applyUrls(payload);
      setMessage(labels.saved);
      startTransition(() => router.refresh());
    } catch {
      setError(labels.saveFailed);
    }
  }

  const slots: AssetSlot[] = [
    {
      key: "logo",
      label: labels.logo,
      url: logoUrl,
      accept: "image/png,image/jpeg,image/webp",
    },
    {
      key: "logo_compact",
      label: labels.logoCompact,
      url: logoCompactUrl,
      accept: "image/png,image/jpeg,image/webp",
    },
    {
      key: "favicon",
      label: labels.favicon,
      url: faviconUrl,
      accept: "image/png,image/jpeg,image/webp,image/x-icon,.ico",
    },
    {
      key: "hero",
      label: labels.heroImage,
      url: heroImageUrl,
      accept: "image/png,image/jpeg,image/webp",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">{labels.brandHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.brandDescription}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {slots.map((slot) => (
            <div
              key={slot.key}
              className="space-y-3 rounded-lg border border-border/80 bg-background p-3"
            >
              <p className="text-sm font-medium">{slot.label}</p>
              <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-surface p-3">
                {slot.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.url}
                    alt={slot.label}
                    className={
                      slot.key === "hero"
                        ? "max-h-36 w-full object-contain"
                        : "max-h-16 max-w-full object-contain"
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {labels.previewMissing} · {labels.usingDefault}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept={slot.accept}
                    className="sr-only"
                    disabled={!canWrite || pending}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void uploadAsset(slot.key, file);
                      event.target.value = "";
                    }}
                  />
                  <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-accent">
                    {slot.url ? labels.replace : labels.upload}
                  </span>
                </label>
                {slot.url ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canWrite || pending}
                    onClick={() => void clearAsset(slot.key)}
                  >
                    {slot.key === "hero"
                      ? labels.removeImage
                      : labels.restoreDefault}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">{labels.homeHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels.homeDescription}
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span>{labels.heroEyebrow}</span>
          <Input
            value={heroEyebrow}
            disabled={!canWrite || pending}
            onChange={(event) => setHeroEyebrow(event.target.value)}
            maxLength={120}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.heroTitle}</span>
          <Input
            value={heroTitle}
            disabled={!canWrite || pending}
            onChange={(event) => setHeroTitle(event.target.value)}
            maxLength={160}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.heroDescription}</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={heroDescription}
            disabled={!canWrite || pending}
            onChange={(event) => setHeroDescription(event.target.value)}
            maxLength={480}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.searchPlaceholder}</span>
          <Input
            value={searchPlaceholder}
            disabled={!canWrite || pending}
            onChange={(event) => setSearchPlaceholder(event.target.value)}
            maxLength={160}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{labels.heroImageAlt}</span>
          <Input
            value={heroImageAlt}
            disabled={!canWrite || pending}
            onChange={(event) => setHeroImageAlt(event.target.value)}
            maxLength={160}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!canWrite || pending}
            onClick={() => void saveText()}
          >
            {pending ? labels.saving : labels.save}
          </Button>
          {message ? (
            <p className="text-sm text-success-foreground" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
