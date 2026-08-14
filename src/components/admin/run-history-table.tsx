import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
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
 * `admin_audit_log` DISCOVERY_RUN entries, which the panel description states
 * rather than implying a richer source. Two real limits follow: only completed
 * runs appear, and a run that crashed before writing its audit row is absent.
 *
 * A dash means the field is missing from the recorded payload — deliberately
 * not rendered as zero, which would read as "found nothing".
 */
function cell(value: number | null): string {
  return value == null ? "—" : String(value);
}

export function RunHistoryTable({ t, locale, runs }: RunHistoryTableProps) {
  return (
    <AdminPanel
      title={t.discovery.runHistory}
      description={t.discovery.runHistoryDescription}
      flush
    >
      {runs.length === 0 ? (
        <AdminEmptyState message={t.discovery.runHistoryEmpty} />
      ) : (
        <AdminTable caption={t.discovery.runHistory}>
          <thead>
            <tr>
              <AdminTh>{t.discovery.runTime}</AdminTh>
              <AdminTh>{t.discovery.runScope}</AdminTh>
              <AdminTh numeric>{t.discovery.runQueries}</AdminTh>
              <AdminTh numeric>{t.discovery.runCreated}</AdminTh>
              <AdminTh numeric>{t.discovery.runDuplicates}</AdminTh>
              <AdminTh numeric>{t.discovery.runInvalid}</AdminTh>
              <AdminTh numeric>{t.discovery.runErrors}</AdminTh>
              <AdminTh>{t.discovery.runActor}</AdminTh>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const failed = (run.errors ?? 0) > 0;

              return (
                <AdminTr key={run.id}>
                  <AdminTd className="whitespace-nowrap text-muted-foreground">
                    {run.at.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB")}
                  </AdminTd>
                  <AdminTd className="max-w-[14rem] truncate">
                    {run.scope}
                  </AdminTd>
                  <AdminTd numeric>{cell(run.queriesProcessed)}</AdminTd>
                  <AdminTd numeric className="font-medium">
                    {cell(run.created)}
                  </AdminTd>
                  <AdminTd numeric className="text-muted-foreground">
                    {cell(run.duplicates)}
                  </AdminTd>
                  <AdminTd numeric className="text-muted-foreground">
                    {cell(run.invalid)}
                  </AdminTd>
                  <AdminTd
                    numeric
                    className={
                      failed
                        ? "font-medium text-destructive-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {cell(run.errors)}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <Badge variant="outline">{run.actorType}</Badge>
                  </AdminTd>
                </AdminTr>
              );
            })}
          </tbody>
        </AdminTable>
      )}
    </AdminPanel>
  );
}
