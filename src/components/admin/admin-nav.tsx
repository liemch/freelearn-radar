"use client";

import {
  BarChart3,
  BookOpen,
  Inbox,
  LayoutDashboard,
  Layers,
  ListFilter,
  Menu,
  Radar,
  Search,
  Server,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

export type AdminNavIcon =
  | "dashboard"
  | "courses"
  | "candidates"
  | "collection"
  | "providers"
  | "queries"
  | "taxonomy"
  | "users"
  | "analytics"
  | "search"
  | "embeddings";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
};

export type AdminNavLabels = {
  openMenu: string;
  closeMenu: string;
  sections: string;
  /** Second line under the wordmark, e.g. "Admin console". */
  subtitle: string;
};

const ICONS: Record<AdminNavIcon, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  candidates: Inbox,
  collection: Radar,
  providers: Server,
  queries: ListFilter,
  taxonomy: Tags,
  users: Users,
  analytics: BarChart3,
  search: Search,
  embeddings: Layers,
};

/**
 * `/admin/discovery` is a prefix of `/admin/discovery/queries`, so a plain
 * `startsWith` would highlight two items at once. Only the dashboard needs an
 * exact match; for the rest, the most specific matching item wins.
 */
function isActive(
  pathname: string,
  href: string,
  items: AdminNavItem[],
): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;

  const deeper = items.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
  return !deeper;
}

function NavList({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <ul className="space-y-px">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href, items);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded px-2.5 py-1.5 text-[0.8125rem] transition",
                active
                  ? "bg-admin-nav-active font-medium text-admin-nav-foreground"
                  : "text-admin-nav-muted hover:bg-admin-nav-active/60 hover:text-admin-nav-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavBrand({ subtitle }: { subtitle: string }) {
  return (
    <Link
      href="/admin"
      className="flex min-w-0 items-center gap-2 px-2.5 py-3 text-admin-nav-foreground"
    >
      <BrandMark className="size-5 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-semibold leading-tight">
          FreeLearn Radar
        </span>
        <span className="block truncate text-[0.625rem] uppercase tracking-[0.12em] leading-tight text-admin-nav-muted">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}

/**
 * Persistent rail from `lg` up. Deep brand surface rather than a third white
 * column: it separates the console from the public site instantly, and gives
 * the rail enough presence to justify the width it occupies.
 */
export function AdminNavRail({
  items,
  labels,
}: {
  items: AdminNavItem[];
  labels: AdminNavLabels;
}) {
  return (
    <div className="sticky top-0 hidden h-screen w-[13.5rem] shrink-0 flex-col border-r border-admin-nav-border bg-admin-nav lg:flex">
      <NavBrand subtitle={labels.subtitle} />
      <nav
        aria-label={labels.sections}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
      >
        <NavList items={items} />
      </nav>
    </div>
  );
}

/**
 * Below `lg` the rail becomes a drawer rather than a squeezed column — a 56px
 * sidebar with clipped labels is worse than no sidebar.
 */
export function AdminMobileNav({
  items,
  labels,
}: {
  items: AdminNavItem[];
  labels: AdminNavLabels;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A drawer that survived navigation would cover the page it just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.openMenu}
        aria-expanded={open}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition hover:bg-accent lg:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[82vw] flex-col bg-admin-nav">
            <div className="flex items-center justify-between pr-2">
              <NavBrand subtitle={labels.subtitle} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.closeMenu}
                className="inline-flex size-8 items-center justify-center rounded text-admin-nav-muted transition hover:bg-admin-nav-active hover:text-admin-nav-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <nav
              aria-label={labels.sections}
              className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
            >
              <NavList items={items} />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
