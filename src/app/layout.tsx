import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import NextTopLoader from "nextjs-toploader";

import { getResolvedBranding } from "@/domain/branding/get-resolved-branding";
import { defaultLocale } from "@/lib/i18n/config";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-fraunces",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getResolvedBranding();

  return {
    title: {
      default: "FreeLearn Radar",
      template: "%s | FreeLearn Radar",
    },
    description:
      branding?.hero.description ??
      "Tìm khóa học trực tuyến miễn phí từ các nền tảng uy tín — được kiểm chứng và cập nhật mỗi ngày.",
    metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
    icons: branding?.faviconUrl
      ? {
          icon: [{ url: branding.faviconUrl }],
          shortcut: branding.faviconUrl,
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Vietnamese is the only product UI language (M20.14), so the server-rendered
    // document declares it. `LocaleHtmlLang` only ever narrows this for the legacy
    // /en routes after hydration — crawlers and screen readers read this value.
    <html
      lang={defaultLocale}
      className={`${manrope.variable} ${fraunces.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <NextTopLoader
          color="var(--primary)"
          height={2}
          showSpinner={false}
          shadow={false}
          crawlSpeed={180}
        />
        {children}
      </body>
    </html>
  );
}
