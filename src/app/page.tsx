import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            FreeLearn Radar
          </Link>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            MVP Foundation
          </span>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Learn more. Spend $0.
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Discover free online courses worth your time
          </h1>
          <p className="text-lg text-muted-foreground">
            FreeLearn Radar curates and verifies free courses from Coursera,
            Udemy, edX, Microsoft Learn, and more — so you don&apos;t have to
            hunt across every platform.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button size="lg" disabled aria-disabled>
              Explore Free Courses
            </Button>
            <Button variant="outline" size="lg" disabled aria-disabled>
              Free This Week
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Public catalog pages arrive in WP3. Foundation is live.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Verified free status",
              body: "Know if a course is fully free, audit-only, or temporarily free.",
            },
            {
              title: "AI-assisted summaries",
              body: "Quick insights on why a course is worth learning — with human review.",
            },
            {
              title: "One place to browse",
              body: "Filter by topic, provider, and level without jumping between sites.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-sm text-muted-foreground">
        FreeLearn Radar — Course Discovery Engine (WP0 Foundation)
      </footer>
    </main>
  );
}
