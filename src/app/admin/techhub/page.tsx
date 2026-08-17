import { redirect } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TechhubPushAdmin } from "@/components/admin/techhub-push-admin";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";
import {
  getTechhubClient,
  isTechhubConfigured,
} from "@/services/techhub/get-client";

export const dynamic = "force-dynamic";

export default async function AdminTechhubPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "ADMIN") redirect("/admin");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  const configured = isTechhubConfigured();
  let connected = false;
  if (configured) {
    try {
      connected = await getTechhubClient().testConnection();
    } catch {
      connected = false;
    }
  }

  return (
    <>
      <AdminPageHeader
        title={t.techhub.heading}
        description={t.techhub.description}
      />
      <TechhubPushAdmin
        initialConfigured={configured}
        initialConnected={connected}
        labels={t.techhub}
      />
    </>
  );
}
