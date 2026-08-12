"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/search", label: "Search" },
  { href: "/category/ai", label: "Categories" },
  { href: "/best/2026/08", label: "Best" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:text-xl"
        >
          FreeLearn Radar
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">Admin</Link>
          </Button>
        </nav>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </Button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          className="border-t border-border/70 px-4 py-3 sm:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/admin"
                className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
