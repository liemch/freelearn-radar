import { notFound } from "next/navigation";

import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) {
    notFound();
  }

  const locale = raw as Locale;
  getDictionary(locale);

  return <div data-locale={locale}>{children}</div>;
}

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "vi" }];
}
