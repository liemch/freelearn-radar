import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/70 bg-muted/20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-semibold tracking-tight">FreeLearn Radar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated free course discovery — free status verified before AI hype.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-4 text-sm">
          <Link href="/search" className="hover:text-primary">
            Search
          </Link>
          <Link href="/category/ai" className="hover:text-primary">
            Categories
          </Link>
          <Link href="/best/2026/08" className="hover:text-primary">
            Best this month
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/50 py-3 text-center text-xs text-muted-foreground">
        © {year} FreeLearn Radar
      </div>
    </footer>
  );
}
