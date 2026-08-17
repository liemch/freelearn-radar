import { getServerEnv } from "@/lib/env";
import { TechhubSupabaseClient } from "@/services/techhub/supabase-client";
import type { TechhubConfig } from "@/services/techhub/types";

export function getTechhubConfig(): TechhubConfig | null {
  const env = getServerEnv();
  const url = env.TECHHUB_SUPABASE_URL.trim();
  const anonKey = env.TECHHUB_SUPABASE_ANON_KEY.trim();

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
    usersTable: env.TECHHUB_SUPABASE_USERS_TABLE.trim() || "users",
  };
}

export function isTechhubConfigured(): boolean {
  return getTechhubConfig() !== null;
}

export function getTechhubClient(): TechhubSupabaseClient {
  const config = getTechhubConfig();
  if (!config) {
    throw new Error("TECHHUB_NOT_CONFIGURED");
  }

  return new TechhubSupabaseClient(config);
}
