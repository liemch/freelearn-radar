import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLogoutButton } from "@/components/admin/logout-button";
import { UserRoleSelect } from "@/components/admin/user-role-select";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href="/admin" className="hover:underline">
                {t.common.admin}
              </Link>{" "}
              / {t.nav.users}
            </p>
            <h1 className="text-xl font-semibold">{t.users.heading}</h1>
          </div>
          <AdminLogoutButton
            label={t.common.signOut}
            signingOutLabel={t.common.signingOut}
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <p className="text-sm text-muted-foreground">{t.users.description}</p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">{t.users.email}</th>
                <th className="px-4 py-3 font-medium">{t.users.role}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <UserRoleSelect
                      userId={user.id}
                      role={user.role}
                      labels={{
                        updateFailed: t.users.updateFailed,
                        lastAdmin: t.users.lastAdmin,
                      }}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t.users.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
