import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — only for trusted server contexts
 * (API routes, edge functions, webhooks). Never import from client components.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabase.url(), env.supabase.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
