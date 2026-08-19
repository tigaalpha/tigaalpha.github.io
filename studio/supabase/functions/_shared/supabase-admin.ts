import { createClient } from "npm:@supabase/supabase-js@2";

/** Service-role client — bypasses RLS. Only ever used inside Edge Functions. */
export function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
