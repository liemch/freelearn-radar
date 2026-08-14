"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  INTEREST_OPTIONS,
  type InterestSlug,
  readInterestsFromStorage,
  writeInterestsToStorage,
} from "@/domain/discovery/interests";
import { cn } from "@/lib/utils";

type InterestPickerProps = {
  enabled: boolean;
  title: string;
  description: string;
  saveLabel: string;
  savedLabel: string;
  className?: string;
  onChange?: (slugs: InterestSlug[]) => void;
};

export function InterestPicker({
  enabled,
  title,
  description,
  saveLabel,
  savedLabel,
  className,
  onChange,
}: InterestPickerProps) {
  const [selected, setSelected] = useState<InterestSlug[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const stored = readInterestsFromStorage(
      typeof window !== "undefined" ? window.localStorage : null,
    );
    setSelected(stored);
    setHydrated(true);
    onChange?.(stored);
    // Intentionally mount-only; parent receives updates via onChange after toggles/save.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, [enabled]);

  if (!enabled) return null;

  function toggle(slug: InterestSlug) {
    setSelected((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((item) => item !== slug)
        : [...prev, slug].slice(0, 8);
      return next;
    });
    setJustSaved(false);
  }

  function save() {
    writeInterestsToStorage(
      typeof window !== "undefined" ? window.localStorage : null,
      selected,
    );
    onChange?.(selected);
    setJustSaved(true);
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/70 bg-card p-4 sm:p-5",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label={title}>
        {INTEREST_OPTIONS.map((option) => {
          const active = selected.includes(option.slug);
          return (
            <li key={option.slug}>
              <button
                type="button"
                disabled={!hydrated}
                aria-pressed={active}
                onClick={() => toggle(option.slug)}
                className={cn(
                  "min-h-10 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "border-border bg-background hover:border-primary/30 hover:bg-accent/60",
                  !hydrated && "opacity-60",
                )}
              >
                {option.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={save} disabled={!hydrated}>
          {saveLabel}
        </Button>
        {justSaved ? (
          <p className="text-sm text-muted-foreground" role="status">
            {savedLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
