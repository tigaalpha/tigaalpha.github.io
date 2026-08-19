// record-revenue — back-fill a sale that already happened (paid in the
// bank, possibly long ago) but was never entered in the system. Staff-triggered
// counterpart of the LINE command \"บันทึกยอด\"; both call the same
// _shared/revenue.ts recordRevenue so they can never drift.
//
//   Request:  { customerId, amount, date?, note? }
//   Response: { reference, paymentId, customerName }
//
// Creates a paid payment + income transaction, wins the customer if they
// were still a lead, and refreshes their lead score.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { recordRevenue } from "../_shared/revenue.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    await requireStaff(admin, req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const customerId = typeof body.customerId === "string" ? body.customerId : "";
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const date = typeof body.date === "string" && body.date ? body.date : undefined;
    const note = typeof body.note === "string" && body.note ? body.note : undefined;

    if (!customerId) return jsonResponse({ error: "customerId is required" }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return jsonResponse({ error: "amount must be > 0 and <= 1,000,000" }, 400);

    const result = await recordRevenue(admin, { customerId, amount, date, note, source: "หน้า การชำระเงิน" });
    return jsonResponse(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return jsonResponse({ error: message }, 400);
  }
});
