import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient<Database>(env.supabase.url(), env.supabase.anonKey());
}
