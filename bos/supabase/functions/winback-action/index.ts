import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { push as linePush } from "../_shared/line.ts";
import { createPayment } from "../_shared/payments.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Feature #4 — win-back approval. Owner approves an AI-drafted offer:
// a payment link is created for the offer amount and the offer + payment
// details are pushed to the customer's LINE. Reject/dismiss just closes it.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireOwnerOrAdmin(admin, req);
    const { id, action } = await req.json();
    if (!id || !["approve", "reject", "dismiss"].includes(action)) {
      return jsonResponse({ error: "id and action (approve|reject|dismiss) are required" }, 400);
    }

    const { data: campaign, error: cErr } = await admin
      .from("winback_campaigns")
      .select("id, customer_id, offer_text, offer_amount, status, customers(line_user_id, name)")
      .eq("id", id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!campaign) return jsonResponse({ error: "campaign not found" }, 404);

    if (action === "reject" || action === "dismiss") {
      await admin.from("winback_campaigns").update({ status: action }).eq("id", id);
      return jsonResponse({ status: action });
    }

    if (campaign.status !== "pending") return jsonResponse({ error: "campaign already processed" }, 409);

    const customer = Array.isArray(campaign.customers) ? campaign.customers[0] : campaign.customers;

    // Offer amount defaults to the customer's last course price if not set.
    let amount = campaign.offer_amount ? Number(campaign.offer_amount) : null;
    if (!amount) {
      const { data: lastCourse } = await admin.from("courses").select("price").eq("customer_id", campaign.customer_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      amount = lastCourse?.price ? Number(lastCourse.price) : null;
    }

    let paymentId: string | null = null;
    let sentText = campaign.offer_text;
    if (amount && amount > 0) {
      const payment = await createPayment(admin, { customerId: campaign.customer_id, amount, note: `Win-back: ${campaign.offer_text.slice(0, 120)}`, notifyCustomer: false });
      paymentId = payment.paymentId;
      sentText = `${campaign.offer_text}\n\n${payment.instructions}`;
    }

    let sent = false;
    if (customer?.line_user_id) {
      try {
        await linePush(customer.line_user_id, sentText);
        sent = true;
      } catch {
        // blocked OA — the offer is still visible in the UI for manual followup
      }
    }

    await admin
      .from("winback_campaigns")
      .update({ status: "sent", payment_id: paymentId, sent_at: new Date().toISOString() })
      .eq("id", id);

    return jsonResponse({ status: "sent", sent, paymentId });
  } catch (error) {
    return await handleUnexpectedError(admin, "winback-action", error);
  }
});
