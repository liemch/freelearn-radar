/**
 * Guards that a feature flag is a *runtime* kill switch.
 *
 * A page that reads `FEATURE_*` and is statically prerendered bakes the
 * build-time flag value into its HTML. Flipping the flag then does nothing until
 * a rebuild and redeploy, which contradicts §77 rule 32 (every feature ships with
 * a kill switch) and the under-15-minute rollback §98.3 asks for.
 *
 * Three pages shipped this way — compare, path and tracker — and the symptom was
 * invisible: the page returns HTTP 200 with a "not found" body, so it reads as a
 * disabled feature rather than a broken switch.
 *
 * A page is safe if it opts out of static rendering (`force-dynamic`) or revalidates
 * on every request.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const APP_DIR = path.join(process.cwd(), "src", "app");

function findPageFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

/** `FEATURE_X` reads that actually gate rendering, not incidental mentions. */
const FLAG_READ = /FEATURE_[A-Z0-9_]+/g;
const OPTS_OUT_OF_STATIC =
  /export const dynamic\s*=\s*["'](force-dynamic|force-no-store)["']|export const revalidate\s*=\s*0/;

describe("feature flags are runtime kill switches", () => {
  const pages = findPageFiles(APP_DIR);

  it("finds the app router pages", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  const offenders: string[] = [];

  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    const flags = [...new Set(source.match(FLAG_READ) ?? [])];
    if (flags.length === 0) continue;

    // Pages under a dynamic segment with a DB read are already request-rendered;
    // the risk is a page with no dynamic input, which Next will happily prerender.
    // Requiring the explicit opt-out on every flag-gated page removes the need to
    // reason about which ones Next chose to prerender this build.
    if (OPTS_OUT_OF_STATIC.test(source)) continue;

    // A route with a dynamic `[param]` segment cannot be fully prerendered
    // without generateStaticParams, so it evaluates flags per request.
    const relative = path.relative(APP_DIR, file);
    const hasDynamicSegment = relative.includes("[");
    const hasGenerateStaticParams = /generateStaticParams/.test(source);
    if (hasDynamicSegment && !hasGenerateStaticParams) continue;

    offenders.push(`${relative} reads ${flags.join(", ")}`);
  }

  it("no flag-gated page can be statically prerendered", () => {
    expect(offenders).toEqual([]);
  });
});
