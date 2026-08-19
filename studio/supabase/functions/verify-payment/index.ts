// verify-payment — the OWNER confirms a PromptPay transfer actually arrived
// in the studio's bank account. This is the human-in-the-loop gate that
// turns a pending payment into booked revenue (counterpart of the AI's
// mark_payment_paid owner tool; both call _shared/payments.ts confirmPayment).
//
//   Request:  { paymentId, note? }
//   Response: { payment, transaction }
//
// Effect (see confirmPayment): payments.status → paid, an income transaction
// is recorded in the Accounting ledger, the customer moves to won/renewed in
// the pipeline, and the customer is thanked on LINE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff, requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { confirmPayment } from "../_shared/payments.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await requireOwnerOrAdmin(admin, userId);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    const note = typeof body.note === "string" && body.note ? body.note : undefined;

    if (!paymentId) return jsonResponse({ error: "paymentId is required" }, 400);

    const result = await confirmPayment(admin, { paymentId, confirmedBy: userId, note });
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return jsonResponse({ error: message }, 400);
  }
});
