import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Single browser Supabase client, session persisted in localStorage.
 * `detectSessionInUrl` (default true) automatically completes the OAuth
 * PKCE exchange when Supabase redirects back with `?code=`, so no server
 * callback route is needed in this static-export build.
 */
export function createClient(): SupabaseClient<Database> {
  if (!cachedClient) {
    cachedClient = createSupabaseClient<Database>(env.supabase.url(), env.supabase.anonKey());
  }
  return cachedClient;
}
