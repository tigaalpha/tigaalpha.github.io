import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff, requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import * as calendar from "../_shared/calendar.ts";

interface CancelPaidLessonPayload {
  bookingId: string;
  title: string;
  customerId: string;
  startTime: string;
}

interface AdCampaignSpendPayload {
  campaignId: string;
}

/**
 * Runs the real, previously-deferred action for an approved request. Each
 * type here corresponds to something the AI (or a draft flow) queued
 * instead of doing directly — see approvals.ts / tools.ts / generate-ad-campaign.
 */
async function executeApproved(admin: ReturnType<typeof createAdminClient>, type: string, payload: unknown): Promise<void> {
  if (type === "cancel_paid_lesson") {
    const { bookingId } = payload as CancelPaidLessonPayload;
    const { data: booking, error } = await admin.from("bookings").select("*").eq("id", bookingId).single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") return; // already cancelled by another path — nothing to do

    const { error: updateErr } = await admin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    if (updateErr) throw updateErr;

    if (booking.google_event_id) await calendar.deleteEvent(booking.google_event_id);
    return;
  }

  if (type === "ad_campaign_spend") {
    const { campaignId } = payload as AdCampaignSpendPayload;
    const { error } = await admin.from("ad_campaigns").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", campaignId);
    if (error) throw error;
    return;
  }

  throw new Error(`Unknown approval type: ${type}`);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const status = url.searchParams.get("status") ?? "pending";
      const { data, error } = await admin
        .from("approval_requests")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return jsonResponse({ requests: data ?? [] });
    }

    if (req.method === "POST") {
      const { id, action } = (await req.json()) as { id: string; action: "approve" | "reject" };
      if (!id || (action !== "approve" && action !== "reject")) {
        return jsonResponse({ error: "id and action ('approve' | 'reject') are required" }, 400);
      }

      const { data: request, error: fetchErr } = await admin.from("approval_requests").select("*").eq("id", id).single();
      if (fetchErr || !request) return jsonResponse({ error: "Approval request not found" }, 404);
      if (request.status !== "pending") return jsonResponse({ error: "This request has already been resolved" }, 409);

      if (action === "approve") {
        // Approving executes real money-moving/irreversible actions
        // (cancelling a paid lesson, approving ad spend) -- same privilege
        // tier as record_transaction in _shared/tools.ts, so it needs the
        // same owner/admin check, not just "any staff account."
        await requireOwnerOrAdmin(admin, userId);
        await executeApproved(admin, request.type, request.payload);
      }

      const { data: updated, error: updateErr } = await admin
        .from("approval_requests")
        .update({ status: action === "approve" ? "approved" : "rejected", resolved_by: userId, resolved_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      return jsonResponse({ request: updated });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    return await handleUnexpectedError(admin, "approvals", error);
  }
});
