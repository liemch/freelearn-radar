import { BrandMark } from "@/components/brand/brand-mark";
import { SiteHeaderClient } from "@/components/public/site-header-client";
import { currentBestPath } from "@/domain/discovery/monthly-collection";

export function SiteHeader() {
  const bestHref = currentBestPath();
  const links = [
    { href: bestHref, label: "Explore" },
    { href: "/free-courses/ai", label: "Categories" },
    { href: "/search", label: "Search" },
  ];

  return (
    <SiteHeaderClient
      links={links}
      brand={
        <>
          <BrandMark className="size-7 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
            FreeLearn Radar
          </span>
        </>
      }
    />
  );
}
