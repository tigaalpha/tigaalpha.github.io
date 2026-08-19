import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Single browser Supabase client, session persisted in localStorage.
 * `detectSessionInUrl` is off — AuthGuard exchanges the PKCE `?code=` itself
 * (see features/auth/components/auth-guard.tsx) so there's exactly one
 * place doing the exchange, no race with automatic detection.
 */
export function createClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    cachedClient = createSupabaseClient<Database>(env.supabase.url(), env.supabase.anonKey(), {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}
