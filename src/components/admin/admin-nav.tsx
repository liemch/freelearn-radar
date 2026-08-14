"use client";

import {
  BarChart3,
  BookOpen,
  Inbox,
  LayoutDashboard,
  ListFilter,
  Menu,
  Radar,
  Server,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  | "analytics";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
};

export type AdminNavLabels = {
  openMenu: string;
  closeMenu: string;
  sections: string;
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
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href, items);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
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

/** Persistent rail from `lg` up, where there is width to spare. */
export function AdminNavRail({
  items,
  labels,
}: {
  items: AdminNavItem[];
  labels: AdminNavLabels;
}) {
  return (
    <nav
      aria-label={labels.sections}
      className="hidden w-56 shrink-0 border-r border-border bg-card lg:block"
    >
      <div className="sticky top-[3.25rem] max-h-[calc(100vh-3.25rem)] overflow-y-auto p-3">
        <NavList items={items} />
      </div>
    </nav>
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
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent lg:hidden"
      >
        <Menu className="size-4" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/40"
          />
          <nav
            aria-label={labels.sections}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-sm font-semibold">{labels.sections}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.closeMenu}
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavList items={items} />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
