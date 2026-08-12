import { BrandMark } from "@/components/brand/brand-mark";
import Link from "next/link";

import { currentBestPath } from "@/domain/discovery/monthly-collection";
import { DURATION_BUCKETS } from "@/domain/course/catalog-query";
import { listTopicSlugs } from "@/domain/discovery/topic-landings";

export function SiteFooter() {
  const bestHref = currentBestPath();
  const topics = listTopicSlugs().slice(0, 6);

  return (
    <footer className="mt-auto border-t border-border/70 bg-muted/20">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2.5">
            <BrandMark className="size-6 text-primary" />
            <p className="font-display text-lg font-semibold">FreeLearn Radar</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Curated free courses with clear free status and verification
            freshness. We link to original providers — we do not host course
            content.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">Discover</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/search" className="hover:text-foreground">
                Search
              </Link>
            </li>
            <li>
              <Link
                href="/free-certificate-courses"
                className="hover:text-foreground"
              >
                Free certificate courses
              </Link>
            </li>
            <li>
              <Link
                href={`/collections/${DURATION_BUCKETS.under_1h.slug}`}
                className="hover:text-foreground"
              >
                Under 1 hour
              </Link>
            </li>
            <li>
              <Link href={bestHref} className="hover:text-foreground">
                Best this month
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Topics</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {topics.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/free-courses/${slug}`}
                  className="hover:text-foreground capitalize"
                >
                  {slug.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
