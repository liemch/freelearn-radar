import type { Locale } from "@/lib/i18n/config";

/**
 * The root layout owns `<html>` and is shared by both locales, so the
 * prerendered `lang` cannot vary per locale. This sets it synchronously
 * during HTML parsing (before paint) without opting pages out of SSG.
 * `hreflang` alternates remain the canonical signal for crawlers.
 */
export function LocaleHtmlLang({ locale }: { locale: Locale }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.lang=${JSON.stringify(locale)}`,
      }}
    />
  );
}
