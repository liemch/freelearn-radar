import Link from "next/link";
import type { ReactNode } from "react";

import { AdminLanguageSwitcher } from "@/components/admin/admin-language-switcher";
import {
  AdminMobileNav,
  AdminNavRail,
  type AdminNavItem,
  type AdminNavLabels,
} from "@/components/admin/admin-nav";
import { AdminLogoutButton } from "@/components/admin/logout-button";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import type { SessionPayload } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  session: SessionPayload;
  locale: Locale;
  children: ReactNode;
};

/**
 * One chrome for every admin route, replacing the header markup each page used
 * to repeat — which is why only the dashboard ever showed the role, language
 * switcher, and sign-out.
 *
 * The navigation lists existing routes only; capabilities the signed-in role
 * cannot use are omitted rather than shown and then rejected.
 */
export function AdminShell({ session, locale, children }: AdminShellProps) {
  const t = getAdminDictionary(locale);

  const items: AdminNavItem[] = [
    { href: "/admin", label: t.nav.dashboard, icon: "dashboard" },
    { href: "/admin/courses", label: t.nav.courses, icon: "courses" },
    { href: "/admin/candidates", label: t.nav.candidates, icon: "candidates" },
    { href: "/admin/discovery", label: t.nav.discovery, icon: "collection" },
    {
      href: "/admin/discovery/queries",
      label: t.nav.discoveryQueries,
      icon: "queries",
    },
    { href: "/admin/providers", label: t.nav.providers, icon: "providers" },
    { href: "/admin/taxonomy", label: t.nav.taxonomy, icon: "taxonomy" },
    ...(session.role === "ADMIN"
      ? [{ href: "/admin/users", label: t.nav.users, icon: "users" as const }]
      : []),
    { href: "/admin/analytics", label: t.nav.analytics, icon: "analytics" },
  ];

  const navLabels: AdminNavLabels = {
    openMenu: t.common.openMenu,
    closeMenu: t.common.closeMenu,
    sections: t.common.sections,
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-[3.25rem] items-center gap-3 px-4 sm:px-5">
          <AdminMobileNav items={items} labels={navLabels} />

          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2 rounded-md"
          >
            <BrandMark className="size-6 shrink-0 text-primary" />
            <span className="min-w-0 truncate">
              <span className="block text-sm font-semibold leading-tight">
                FreeLearn Radar
              </span>
              <span className="block text-[0.6875rem] leading-tight text-muted-foreground">
                {t.common.adminDashboard}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="brand" className="hidden sm:inline-flex">
              {session.role}
            </Badge>
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:inline">
              {session.email}
            </span>
            <AdminLanguageSwitcher locale={locale} label={t.common.language} />
            <AdminLogoutButton
              label={t.common.signOut}
              signingOutLabel={t.common.signingOut}
            />
          </div>
        </div>
      </header>

      <div className="flex items-start">
        <AdminNavRail items={items} labels={navLabels} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
