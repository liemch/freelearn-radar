import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";

import { defaultLocale } from "@/lib/i18n/config";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FreeLearn Radar",
    template: "%s | FreeLearn Radar",
  },
  // Vietnamese-only product (M20.14 §116.2 covers system-generated SEO metadata).
  description:
    "Tìm khóa học trực tuyến miễn phí từ các nền tảng uy tín — được kiểm chứng và cập nhật mỗi ngày.",
  metadataBase: new URL(
    process.env.APP_URL || "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Vietnamese is the only product UI language (M20.14), so the server-rendered
    // document declares it. `LocaleHtmlLang` only ever narrows this for the legacy
    // /en routes after hydration — crawlers and screen readers read this value.
    <html lang={defaultLocale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
