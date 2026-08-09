import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff, requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import * as calendar from "../_shared/calendar.ts";
import * as line from "../_shared/line.ts";

interface CancelPaidLessonPayload {
  bookingId: string;
  title: string;
  customerId: string;
  startTime: string;
}

interface AdCampaignSpendPayload {
  campaignId: string;
}

interface AiDraftedMessagePayload {
  customerId: string;
  message: string;
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

  if (type === "ai_drafted_message") {
    const { customerId, message } = payload as AiDraftedMessagePayload;
    const { data: customer, error } = await admin.from("customers").select("line_user_id").eq("id", customerId).maybeSingle();
    if (error) throw error;
    // LINE can only push to a user who has already added the OA as a
    // friend — same constraint as automation-actions.ts's send_line_message.
    if (!customer?.line_user_id) throw new Error("ลูกค้าคนนี้ยังไม่เคยทักแชท LINE มา — ส่งข้อความนี้ให้ไม่ได้");
    await line.push(customer.line_user_id, message);
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
      const { id, action, editedPayload } = (await req.json()) as {
        id: string;
        action: "approve" | "reject";
        editedPayload?: Record<string, unknown>;
      };
      if (!id || (action !== "approve" && action !== "reject")) {
        return jsonResponse({ error: "id and action ('approve' | 'reject') are required" }, 400);
      }

      const { data: request, error: fetchErr } = await admin.from("approval_requests").select("*").eq("id", id).single();
      if (fetchErr || !request) return jsonResponse({ error: "Approval request not found" }, 404);
      if (request.status !== "pending") return jsonResponse({ error: "This request has already been resolved" }, 409);

      if (action === "approve") {
        // Approving executes real money-moving/irreversible actions
        // (cancelling a paid lesson, approving ad spend, sending an
        // AI-drafted message) -- same privilege tier as record_transaction
        // in _shared/tools.ts, so it needs the same owner/admin check, not
        // just "any staff account."
        await requireOwnerOrAdmin(admin, userId);
      }

      // Lets staff edit an AI-drafted message before it's sent (the "Edit
      // Before Send" step in the Level 3 plan) instead of only being able
      // to approve verbatim or reject outright.
      const payload = editedPayload && request.type === "ai_drafted_message" ? { ...request.payload, ...editedPayload } : request.payload;

      // Atomic claim: the earlier status read above is only a fast-path
      // rejection for the common case -- this update's `eq("status",
      // "pending")` is what actually prevents two near-simultaneous
      // requests (double-click, client retry) from both passing the read
      // and both executing. Only the request that flips the row wins.
      const { data: claimed, error: claimErr } = await admin
        .from("approval_requests")
        .update({ status: action === "approve" ? "approved" : "rejected", payload, resolved_by: userId, resolved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      if (claimErr) throw claimErr;
      if (!claimed) return jsonResponse({ error: "This request has already been resolved" }, 409);

      if (action === "approve") {
        try {
          await executeApproved(admin, claimed.type, claimed.payload);
        } catch (execErr) {
          // The claim already flipped status to "approved" -- if the actual
          // action failed (LINE push down, booking already gone, etc.),
          // revert to "pending" so it shows back up for a retry instead of
          // silently sitting "approved" but never actually executed.
          await admin.from("approval_requests").update({ status: "pending", resolved_by: null, resolved_at: null }).eq("id", id);
          throw execErr;
        }
      }

      return jsonResponse({ request: claimed });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    return await handleUnexpectedError(admin, "approvals", error);
  }
});
