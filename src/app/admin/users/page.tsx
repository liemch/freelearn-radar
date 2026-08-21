import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import {
  AdminTable,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-table";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { UserSessionRevokeButton } from "@/components/admin/user-session-revoke-button";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { listUsers } from "@/db/repositories/user-repository";
import { getSession } from "@/lib/auth/guards";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "ADMIN") redirect("/admin");

  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  let users: Awaited<ReturnType<typeof listUsers>> = [];
  try {
    users = await listUsers(getDb());
  } catch {
    users = [];
  }

  return (
    <>
      <AdminPageHeader
        title={t.users.heading}
        description={t.users.description}
      />

      <AdminPanel
        title={t.users.heading}
        actions={<Badge variant="outline">{users.length}</Badge>}
        flush
      >
        {users.length === 0 ? (
          <AdminEmptyState message={t.users.empty} />
        ) : (
          <AdminTable caption={t.users.heading}>
            <thead>
              <tr>
                <AdminTh>{t.users.email}</AdminTh>
                <AdminTh>{t.users.role}</AdminTh>
                <AdminTh>{t.users.sessions}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <AdminTr key={user.id}>
                  <AdminTd>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {user.name}
                    </p>
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <UserRoleSelect
                      userId={user.id}
                      role={user.role}
                      labels={{
                        updateFailed: t.users.updateFailed,
                        lastAdmin: t.users.lastAdmin,
                      }}
                    />
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap">
                    <UserSessionRevokeButton
                      userId={user.id}
                      labels={{
                        action: t.users.revokeSessions,
                        done: t.users.revokeSessionsDone,
                        failed: t.users.revokeSessionsFailed,
                      }}
                    />
                  </AdminTd>
                </AdminTr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </AdminPanel>
    </>
  );
}
