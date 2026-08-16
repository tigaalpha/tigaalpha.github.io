import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { push as linePush } from "./line.ts";

export type ApprovalType = "cancel_paid_lesson" | "ad_campaign_spend" | "ai_drafted_message" | "bulk_sales_status_change";

const TYPE_LABEL: Record<ApprovalType, string> = {
  cancel_paid_lesson: "ยกเลิกคาบเรียน",
  ad_campaign_spend: "งบโฆษณา",
  ai_drafted_message: "ข้อความที่ AI ร่าง",
  bulk_sales_status_change: "เปลี่ยนสถานะลูกค้าหลายราย",
};

/**
 * Creates a durable, staff-reviewed approval request instead of letting the
 * AI perform a high-risk action immediately. The action itself only runs
 * once a staff member approves it via the approvals edge function — see
 * that function for the corresponding execution logic per type.
 *
 * Feature #7 (CEO autopilot + approvals loop): the owner is told on LINE
 * the moment a request is filed — otherwise "AI เสนอ → คุณอนุมัติ" stalls
 * silently in the approvals tab and nothing ever gets executed. The push is
 * best-effort (LINE may be unconfigured); the approval_requests row is the
 * source of truth either way.
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

  await admin.from("notifications").insert({
    type: "approval_pending",
    title: `AI ขออนุมัติ: ${TYPE_LABEL[type] ?? type}`,
    body: (reason ?? "").slice(0, 500),
  });

  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    const customerHint =
      type === "cancel_paid_lesson" && typeof payload.title === "string"
        ? ` (${payload.title})`
        : type === "bulk_sales_status_change" && Array.isArray(payload.customerIds)
          ? ` (${payload.customerIds.length} คน)`
          : "";
    linePush(ownerRow.value, `📋 AI ขออนุมัติ: ${TYPE_LABEL[type] ?? type}${customerHint}\n${String(reason ?? "").slice(0, 150)}\nกดอนุมัติได้ที่หน้า การอนุมัติ ในแอพ`).catch(() => {});
  }

  return { id: data.id };
}
