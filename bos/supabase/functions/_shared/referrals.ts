import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { push as linePush } from "./line.ts";

/**
 * Shared referral attribution — the one place that links "a new lead arrived
 * with referral code X" to the referrals table.
 *
 * Why this exists: migration 0077 created referrals + customers.referral_code
 * and payments.ts already reminds the owner to reward a referral whose friend
 * paid — but nothing ever WROTE referred_customer_id, because neither the web
 * widget nor the LINE AI could accept a code. This helper is called from both
 * surfaces (web-chat lead capture + apply_referral_code tool), so attribution
 * behaves identically no matter where the lead lands. The DB function
 * public.apply_referral_code (supabase-referral-loop-migration.sql) does the
 * actual write: it is idempotent per referred customer, rejects self-referrals,
 * stamps customers.acquired_via_referral_code, and notifies the owner.
 *
 * The LINE push is best-effort (fire-and-forget, never throws) — same as every
 * other owner alert in tools.ts.
 */
export async function attributeReferral(
  db: SupabaseClient,
  rawCode: string,
  referredCustomerId: string | null,
  referredName: string | null,
  referredPhone: string | null,
): Promise<{ ok: boolean; reason?: string; status?: string }> {
  const code = String(rawCode ?? "").trim();
  if (!code) return { ok: false, reason: "empty_code" };

  const { data, error } = await db.rpc("apply_referral_code", {
    p_referral_code: code,
    p_referred_customer_id: referredCustomerId,
    p_referred_name: referredName,
    p_referred_phone: referredPhone,
  });
  if (error) {
    console.error("apply_referral_code failed:", error.message);
    return { ok: false, reason: "rpc_error" };
  }

  const result = data as { ok: boolean; reason?: string; status?: string } | null;
  // New attribution (not an idempotent no-op) → also ping the owner on LINE so
  // they know a fresh lead came through word-of-mouth right now.
  if (result?.ok && result.status === "created" && referredCustomerId) {
    const { data: ownerRow } = await db
      .from("integration_settings")
      .select("value")
      .eq("key", "owner_line_user_id")
      .maybeSingle();
    if (ownerRow?.value) {
      const who = referredName ? ` ${referredName}` : "";
      linePush(ownerRow.value, `🎁 ลูกค้าใหม่จากรีเฟอรัล โค้ด ${code.toUpperCase()}${who} — เข้า CRM แล้ว`).catch(() => {});
    }
  }
  return result ?? { ok: false, reason: "no_result" };
}
