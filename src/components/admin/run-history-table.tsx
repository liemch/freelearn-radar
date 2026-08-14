import { Badge } from "@/components/ui/badge";
import type { DiscoveryRunRecord } from "@/domain/admin/operations-snapshot";
import type { AdminDictionary } from "@/lib/i18n/admin/types";

type RunHistoryTableProps = {
  t: AdminDictionary;
  locale: string;
  runs: DiscoveryRunRecord[];
};

/**
 * Discovery has no run table; this history is reconstructed from
 * `admin_audit_log` DISCOVERY_RUN entries. That is stated in the panel
 * description rather than hidden, because it explains the two real limits:
 * only completed runs appear, and a run that crashed before writing its audit
 * row is not here at all.
 *
 * A dash means the field is absent from the recorded payload — deliberately not
 * rendered as zero, which would read as "nothing found" instead of "not known".
 */
function cell(value: number | null, fallback: string): string {
  return value == null ? fallback : String(value);
}

export function RunHistoryTable({ t, locale, runs }: RunHistoryTableProps) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t.discovery.runHistory}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.discovery.runHistoryDescription}
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {t.discovery.runHistoryEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">{t.discovery.runHistory}</caption>
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                  {t.discovery.runTime}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                  {t.discovery.runScope}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {t.discovery.runQueries}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {t.discovery.runCreated}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {t.discovery.runDuplicates}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {t.discovery.runInvalid}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">
                  {t.discovery.runErrors}
                </th>
                <th scope="col" className="whitespace-nowrap px-4 py-2 font-medium">
                  {t.discovery.runActor}
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {run.at.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}
                  </td>
                  <td className="px-4 py-2">{run.scope}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {cell(run.queriesProcessed, t.discovery.notRecorded)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {cell(run.created, "—")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {cell(run.duplicates, "—")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {cell(run.invalid, "—")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {run.errors != null && run.errors > 0 ? (
                      <span className="font-medium text-destructive-foreground">
                        {run.errors}
                      </span>
                    ) : (
                      cell(run.errors, "—")
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge variant="outline">{run.actorType}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
