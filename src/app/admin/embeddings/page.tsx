import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { EmbeddingsAdminPanel } from "@/components/admin/embeddings-admin-panel";
import { getDb } from "@/db";
import { getEmbeddingQueueSnapshot } from "@/domain/embedding/embed-batch";
import { getSession } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminEmbeddingsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);
  const env = getServerEnv();

  let queue = { PENDING: 0, OK: 0, FAILED: 0, STALE: 0 };
  try {
    queue = await getEmbeddingQueueSnapshot(getDb());
  } catch {
    // DB optional
  }

  return (
    <>
      <AdminPageHeader
        title={t.embeddings.heading}
        description={t.embeddings.description}
      />
      <div className="mb-4 rounded border border-border bg-card px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
        <p>
          {t.embeddings.model}:{" "}
          <span className="font-medium text-foreground">
            {env.EMBEDDING_MODEL} / {env.EMBEDDING_VERSION}
          </span>
        </p>
        <p className="mt-1">
          {t.embeddings.flagHint}{" "}
          <code className="text-foreground">FEATURE_SEMANTIC_SEARCH</code>
        </p>
      </div>
      <AdminPanel title={t.embeddings.queueHeading}>
        <EmbeddingsAdminPanel
          initialQueue={queue}
          labels={{
            pending: t.embeddings.pending,
            ok: t.embeddings.ok,
            failed: t.embeddings.failed,
            stale: t.embeddings.stale,
            enqueue: t.embeddings.enqueue,
            run: t.embeddings.run,
            running: t.embeddings.running,
            failedAction: t.embeddings.failedAction,
          }}
        />
      </AdminPanel>
    </>
  );
}
