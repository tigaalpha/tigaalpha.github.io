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

/**
 * Mirrors the DB's is_owner_or_admin() (see 0007_rls.sql) for the tools
 * OWNER_TOOLS exposes to TIGA AI AGENT — those write through the
 * service-role client, which bypasses RLS entirely, so a table gated to
 * owner/admin at the RLS layer (transactions) needs this explicit
 * application-level check or any staff member could write to it via chat.
 */
export async function requireOwnerOrAdmin(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    throw new Error("คำสั่งนี้ต้องใช้สิทธิ์เจ้าของร้านหรือแอดมินเท่านั้น");
  }
}
