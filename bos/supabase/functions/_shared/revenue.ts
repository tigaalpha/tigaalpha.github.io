// Shared \"record old/back-filled revenue\" logic — a sale that already
// happened (paid in the bank, possibly long ago) but was never entered in
// the system. Both the LINE owner command (บันทึกยอด) and the Payments
// page's \"บันทึกยอดขายเก่า\" form call this, so they can never drift.
//
// Creates a paid payment + an income transaction, wins the customer if they
// were still pre-sale, refreshes their lead score, and leaves a dashboard
// notification. Returns the reference code for the confirmation message.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { refreshLeadScore } from "./lead-score-db.ts";

export async function recordRevenue(
  admin: SupabaseClient,
  args: { customerId: string; amount: number; date?: string; note?: string; source: string }
): Promise<{ reference: string; paymentId: string; customerName: string }> {
  const { data: customer, error: cErr } = await admin.from("customers").select("id, name, sales_status").eq("id", args.customerId).single();
  if (cErr || !customer) throw new Error("ไม่พบลูกค้านี้");

  const date = args.date && !Number.isNaN(Date.parse(args.date)) ? args.date : new Date().toISOString().slice(0, 10);
  const reference = "R" + Date.now().toString(36).toUpperCase().slice(-6);

  const { data: payment, error: pErr } = await admin
    .from("payments")
    .insert({
      customer_id: customer.id,
      amount: args.amount,
      status: "paid",
      reference_code: reference,
      note: args.note ?? `บันทึกยอดขายเก่า (${args.source})`,
      paid_at: date,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  const { error: tErr } = await admin.from("transactions").insert({
    type: "income",
    category: "ค่าเรียนเปียโน/ดนตรี",
    amount: args.amount,
    description: `ยอดขายเก่า ${customer.name} (${date})${args.source ? ` — ${args.source}` : ""}`,
    transaction_date: date,
    payment_method: "โอนเงิน",
    customer_id: customer.id,
  });
  if (tErr) throw tErr;

  // Win the customer if they're still pre-sale — a recorded sale means the
  // deal actually happened.
  if (!["won", "renewed"].includes(customer.sales_status)) {
    await admin.from("customers").update({ sales_status: "won" }).eq("id", customer.id);
    await admin.from("sales_status_history").insert({
      customer_id: customer.id,
      from_status: customer.sales_status,
      to_status: "won",
      note: `บันทึกยอด ${args.amount} บาท (${date})`,
    });
  }
  await refreshLeadScore(admin, customer.id);

  await admin.from("notifications").insert({
    type: "payment_confirmed",
    title: `บันทึกยอดขายเก่า ${customer.name} ${Number(args.amount).toLocaleString("th-TH")} บาท`,
    body: `วันที่ ${date} อ้างอิง ${reference}`,
    customer_id: customer.id,
  });

  return { reference, paymentId: payment.id, customerName: customer.name };
}
