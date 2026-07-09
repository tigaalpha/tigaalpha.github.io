import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * verify_jwt=true only proves the caller has *some* valid Supabase session —
 * it does not mean they're staff. This checks the profiles table (the same
 * check RLS's is_staff() does) before letting the function perform
 * privileged, service-role-backed actions.
 */
export async function requireStaff(admin: SupabaseClient, req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Authorization header");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid session");

  const { data: profile } = await admin.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
  if (!profile) throw new Error("Not authorized: no staff profile for this account");

  return data.user.id;
}
