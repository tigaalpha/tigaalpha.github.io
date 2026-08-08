import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ApprovalType = "cancel_paid_lesson" | "ad_campaign_spend" | "ai_drafted_message";

/**
 * Creates a durable, staff-reviewed approval request instead of letting the
 * AI perform a high-risk action immediately. The action itself only runs
 * once a staff member approves it via the approvals edge function — see
 * that function for the corresponding execution logic per type.
 */
export async function requestApproval(
  admin: SupabaseClient,
  type: ApprovalType,
  payload: Record<string, unknown>,
  reason: string
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("approval_requests")
    .insert({ type, payload, reason, status: "pending", requested_by: "ai" })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}
