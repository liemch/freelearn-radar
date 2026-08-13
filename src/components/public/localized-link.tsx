"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";

import { useCurrentLocale } from "@/lib/i18n/use-locale";
import { localizeHref } from "@/lib/i18n/path";

type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/**
 * Public Link that always navigates under the locale in the current URL.
 * Stale `/en/...` href props are rewritten to the live locale.
 */
export const LocalizedLink = forwardRef<HTMLAnchorElement, LocalizedLinkProps>(
  function LocalizedLink({ href, ...props }, ref) {
    const locale = useCurrentLocale();
    const localized = localizeHref(href, locale);

    return <Link ref={ref} href={localized} {...props} />;
  },
);
