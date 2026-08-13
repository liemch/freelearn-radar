"use client";

import { useEffect } from "react";

import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { useCurrentLocale } from "@/lib/i18n/use-locale";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const dict = getDictionary(useCurrentLocale());

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {dict.errors.genericTitle}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {dict.errors.genericDescription}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          {dict.errors.tryAgain}
        </Button>
        <Button asChild variant="outline">
          <LocalizedLink href="/search">
            {dict.errors.searchCourses}
          </LocalizedLink>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">
          {dict.errors.reference}: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
