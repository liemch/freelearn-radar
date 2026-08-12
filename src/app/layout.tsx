import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FreeLearn Radar",
    template: "%s | FreeLearn Radar",
  },
  description:
    "Discover the best free online courses from top learning platforms — curated and verified in one place.",
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
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} min-h-screen font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
