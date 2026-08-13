import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { defaultLocale } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/path";

export default function NotFound() {
  const locale = defaultLocale;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <PageShell className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <BrandMark className="mb-6 size-12 text-primary" />
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          That link does not match a course or collection on FreeLearn Radar.
          Try searching, or return home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={localePath(locale, "/search")}>Search courses</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={localePath(locale, "/")}>Go home</Link>
          </Button>
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
