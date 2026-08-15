import Link from "next/link";
import {
  Briefcase,
  Code2,
  Compass,
  FlaskConical,
  Globe2,
  HeartHandshake,
  LineChart,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { SectionHeading } from "@/components/layout/page-shell";

type CategoryItem = {
  slug: string;
  name: string;
  href: string;
};

type CategoryDiscoveryProps = {
  title: string;
  subtitle?: string;
  categories: CategoryItem[];
};

const ICON_BY_SLUG: Record<string, LucideIcon> = {
  "cong-nghe-it": Code2,
  ai: Sparkles,
  programming: Code2,
  "data-science": LineChart,
  business: Briefcase,
  finance: LineChart,
  "soft-skills": HeartHandshake,
  "personal-development": Compass,
  design: Palette,
  language: Globe2,
  science: FlaskConical,
  marketing: Briefcase,
};

const TONE_BY_INDEX = [
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
  "bg-amber-50 text-amber-800",
  "bg-violet-50 text-violet-700",
  "bg-rose-50 text-rose-700",
  "bg-teal-50 text-teal-700",
  "bg-indigo-50 text-indigo-700",
  "bg-orange-50 text-orange-800",
];

function iconFor(slug: string): LucideIcon {
  return ICON_BY_SLUG[slug] ?? Compass;
}

/**
 * Homepage "Khám phá theo lĩnh vực" grid — real taxonomy only.
 */
export function CategoryDiscovery({
  title,
  subtitle,
  categories,
}: CategoryDiscoveryProps) {
  if (categories.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeading title={title} subtitle={subtitle} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category, index) => {
          const Icon = iconFor(category.slug);
          const tone = TONE_BY_INDEX[index % TONE_BY_INDEX.length]!;
          return (
            <li key={category.slug}>
              <Link
                href={category.href}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card focus-visible:outline-none motion-reduce:transform-none"
              >
                <span
                  className={`inline-flex size-11 items-center justify-center rounded-xl ${tone}`}
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold leading-snug tracking-tight group-hover:text-primary">
                  {category.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
