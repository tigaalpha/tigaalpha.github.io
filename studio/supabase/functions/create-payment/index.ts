// create-payment — mint a bank-transfer payment for a customer (staff-triggered
// counterpart of the AI's create_payment_link tool; both call the same
// _shared/payments.ts createPayment so they can never drift).
//
//   Request:  { customerId, amount, courseId?, note? }
//   Response: { paymentId, amount, accountNumber?, bank?, accountName?, referenceCode, qrUrl?, instructions, notified }
//
// Money goes straight to the studio's bank account (direct transfer) —
// nothing is charged here; the owner confirms the transfer via
// verify-payment / mark_payment_paid after checking their banking app.
//
// Staff-triggered path: this pushes the payment details (and QR image when
// available) to the customer's LINE automatically — the AI's
// create_payment_link tool does NOT, since that conversation is already on
// LINE. `notified` in the response tells the UI whether the push landed.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { createPayment } from "../_shared/payments.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const courseId = typeof body.courseId === "string" ? body.courseId : undefined;
    const note = typeof body.note === "string" && body.note ? body.note : undefined;

    if (!customerId) return jsonResponse({ error: "customerId is required" }, 400);
    if (body.amount === undefined || body.amount === null) return jsonResponse({ error: "amount is required" }, 400);

    const result = await createPayment(admin, { customerId, amount: body.amount as number, courseId, note, notifyCustomer: true });
    return jsonResponse(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return jsonResponse({ error: message }, 400);
  }
});
