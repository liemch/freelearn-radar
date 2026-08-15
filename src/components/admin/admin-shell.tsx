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
import type { SessionPayload } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { PUBLIC_LANGUAGE_SWITCHER } from "@/lib/i18n/config";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  session: SessionPayload;
  locale: Locale;
  children: ReactNode;
};

/**
 * One chrome for every admin route.
 *
 * `admin-ui` switches headings to the UI sans face; the editorial serif is a
 * public-site decision and made the console read like an article.
 *
 * The workspace is capped at 1600px rather than the public 1152px container:
 * operations pages carry tables and multi-column panels, and constraining them
 * to a reading measure wastes most of a large display.
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
    { href: "/admin/search", label: t.nav.search, icon: "search" },
    { href: "/admin/embeddings", label: t.nav.embeddings, icon: "embeddings" },
    {
      href: "/admin/monetization",
      label: t.nav.monetization,
      icon: "monetization",
    },
    { href: "/admin/coupons", label: t.nav.coupons, icon: "coupons" },
    { href: "/admin/coverage", label: t.nav.coverage, icon: "coverage" },
    {
      href: "/admin/media-quality",
      label: t.nav.mediaQuality,
      icon: "mediaQuality",
    },
    {
      href: "/admin/branding",
      label: t.nav.branding,
      icon: "branding",
    },
  ];

  const navLabels: AdminNavLabels = {
    openMenu: t.common.openMenu,
    closeMenu: t.common.closeMenu,
    sections: t.common.sections,
    subtitle: t.common.adminDashboard,
  };

  return (
    <div className="admin-ui flex min-h-screen bg-surface">
      <AdminNavRail items={items} labels={navLabels} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card">
          <div className="flex h-12 items-center gap-2.5 px-3 sm:px-5">
            <AdminMobileNav items={items} labels={navLabels} />

            <Link
              href="/admin"
              className="truncate text-[0.8125rem] font-semibold lg:hidden"
            >
              FreeLearn Radar
            </Link>

            {/*
              The account block is context, not content: small, muted, and the
              first thing to drop as the viewport narrows.
            */}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground lg:inline">
                <span className="font-medium text-foreground">
                  {session.role}
                </span>
                <span aria-hidden="true" className="mx-1.5 text-border">
                  ·
                </span>
                <span className="max-w-[13rem] truncate align-bottom">
                  {session.email}
                </span>
              </span>
              {PUBLIC_LANGUAGE_SWITCHER ? (
                <AdminLanguageSwitcher
                  locale={locale}
                  label={t.common.language}
                />
              ) : null}
              <AdminLogoutButton
                label={t.common.signOut}
                signingOutLabel={t.common.signingOut}
              />
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
