import { AdminLoginForm } from "@/components/admin/login-form";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { getAdminLocale } from "@/lib/i18n/admin-locale";

export default async function AdminLoginPage() {
  const locale = await getAdminLocale();
  const t = getAdminDictionary(locale);

  return <AdminLoginForm t={t.login} />;
}
