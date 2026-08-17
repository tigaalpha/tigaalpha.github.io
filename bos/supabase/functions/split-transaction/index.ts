// split-transaction — break a lump-sum income transaction (e.g. \"แดง,
// Angelica, Harmess... 95,401 บาท\" recorded as one row) into per-customer
// rows so the pipeline/renewal/CAC views see money per person. The original
// row's amount is reduced by the split total; if fully split it is removed.
// Staff-only.
//
//   Request:  { transactionId, splits: [{ customerId, amount }] }
//   Response: { created, remaining, transactionId }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    await requireStaff(admin, req);

    const body = (await req.json().catch(() => ({}))) as {
      transactionId?: string;
      splits?: Array<{ customerId?: string; amount?: number }>;
    };
    const transactionId = body.transactionId ?? "";
    const splits = (body.splits ?? []).filter((s) => s.customerId && Number.isFinite(Number(s.amount)) && Number(s.amount) > 0);

    if (!transactionId || splits.length === 0) return jsonResponse({ error: "transactionId and splits are required" }, 400);

    const { data: original, error: origErr } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle();
    if (origErr || !original) return jsonResponse({ error: "ไม่พบรายการที่ระบุ" }, 404);
    if (original.type !== "income") return jsonResponse({ error: "แยกได้เฉพาะรายการรายได้ (income)" }, 400);

    const splitTotal = splits.reduce((sum, s) => sum + Number(s.amount), 0);
    const originalAmount = Number(original.amount);
    if (splitTotal > originalAmount + 0.01) return jsonResponse({ error: `ยอดรวมที่แยก (${splitTotal}) มากกว่ายอดเดิม (${originalAmount})` }, 400);

    // Resolve customer names for the split descriptions.
    const ids = [...new Set(splits.map((s) => s.customerId!))];
    const { data: customers } = await admin.from("customers").select("id, name").in("id", ids);
    const nameById = new Map<string, string>((customers ?? []).map((c) => [c.id, c.name]));

    let created = 0;
    for (const split of splits) {
      const customerName = nameById.get(split.customerId!) ?? "ลูกค้า";
      const { error: insErr } = await admin.from("transactions").insert({
        type: "income",
        category: original.category,
        amount: Number(split.amount),
        description: `${customerName}: ${original.description ?? ""}`.slice(0, 300),
        transaction_date: original.transaction_date,
        payment_method: original.payment_method,
        customer_id: split.customerId!,
      });
      if (insErr) throw insErr;
      created += 1;
    }

    const remaining = originalAmount - splitTotal;
    if (remaining <= 0.01) {
      await admin.from("transactions").delete().eq("id", transactionId);
    } else {
      await admin.from("transactions").update({ amount: remaining }).eq("id", transactionId);
    }

    return jsonResponse({ created, remaining: Math.max(remaining, 0), transactionId, deleted: remaining <= 0.01 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal error";
    return jsonResponse({ error: message }, 400);
  }
});
