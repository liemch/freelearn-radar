import { BrandMark } from "@/components/brand/brand-mark";
import { LocalizedLink } from "@/components/public/localized-link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getPreferredLocale } from "@/lib/i18n/server-locale";

export default async function NotFound() {
  // Root-level 404 has no locale param; the middleware-managed preference
  // cookie is the only locale signal available here.
  const locale = await getPreferredLocale();
  const dict = getDictionary(locale);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <PageShell className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <BrandMark className="mb-6 size-12 text-primary" />
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {dict.errors.notFoundTitle}
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          {dict.errors.notFoundDescription}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <LocalizedLink href="/search">
              {dict.errors.searchCourses}
            </LocalizedLink>
          </Button>
          <Button asChild variant="outline">
            <LocalizedLink href="/">{dict.errors.goHome}</LocalizedLink>
          </Button>
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
