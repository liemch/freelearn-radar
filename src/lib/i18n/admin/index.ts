import { adminEn } from "@/lib/i18n/admin/en";
import { adminVi } from "@/lib/i18n/admin/vi";
import type { AdminDictionary } from "@/lib/i18n/admin/types";
import type { Locale } from "@/lib/i18n/config";

const adminDictionaries: Record<Locale, AdminDictionary> = {
  en: adminEn,
  vi: adminVi,
};

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return adminDictionaries[locale] ?? adminDictionaries.en;
}

export type { AdminDictionary };
