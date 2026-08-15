import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { getSession } from "@/lib/auth/guards";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const metadata: Metadata = {
  title: "Quản trị | FreeLearn Radar",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  // No session means the login page, which deliberately has no chrome. Every
  // other admin route is already gated by middleware, so reaching this branch
  // with real content is not possible.
  if (!session) {
    return children;
  }

  const locale = await getAdminLocale();

  return (
    <AdminShell session={session} locale={locale}>
      {children}
    </AdminShell>
  );
}
