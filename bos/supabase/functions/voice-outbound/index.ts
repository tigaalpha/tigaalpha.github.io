import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const BLAND_API = "https://api.bland.ai/v1/calls";

const PURPOSE_TASKS: Record<string, (ctx: { name: string; amount?: string }) => string> = {
  payment: ({ name, amount }) =>
    `คุณกำลังโทรหา${name} ลูกค้าของโรงเรียนสอนเปียโน TIGA Studio พูดภาษาไทยสุภาพและเป็นธรรมชาติเหมือนพนักงานจริง ` +
    `แจ้งว่ามีใบแจ้งชำระ${amount ? ` ${amount} บาท` : ""}ที่ยังไม่ได้รับเงิน ช่วยสอบถามว่าสะดวกโอนเมื่อไหร่ ` +
    `ถ้าลูกค้าโอนแล้ว ขอบคุณและบอกว่าทีมงานจะตรวจสลิปให้เร็วที่สุด ถ้าลูกค้าสงสัย บอกให้ทักไลน์ร้านมาได้ ` +
    `พูดสั้น กระชับ ไม่ใช้คำที่เป็นสูตรสำเร็จ ปิดท้ายด้วยการถามว่ามีอะไรให้ช่วยอีกไหม`,
  followup: ({ name }) =>
    `คุณกำลังโทรหา${name} ลูกค้าของโรงเรียนสอนเปียโน TIGA Studio พูดภาษาไทยสุภาพเหมือนพนักงานจริง ` +
    `สอบถามว่ายังสนใจเรียนเปียโนอยู่ไหม มีโปรโมชันหรือคอร์สว่างให้เลือก ถ้าสนใจ แนะนำให้ทักไลน์ร้านเพื่อจองเวลาทดลองเรียน ` +
    `พูดสั้น กระชับ ไม่กดดันลูกค้า`,
  nudge: ({ name }) =>
    `คุณกำลังโทรหา${name} ผู้ปกครองนักเรียนของโรงเรียนสอนเปียโน TIGA Studio พูดภาษาไทยสุภาพเหมือนพนักงานจริง ` +
    `แจ้งเตือนว่ามีคาบเรียนที่กำลังจะถึง ช่วยยืนยันว่าสะดวกมาเรียนตามเวลาหรือต้องการเลื่อน ` +
    `พูดสั้น กระชับ และปิดท้ายอย่างเป็นมิตร`,
};

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireOwnerOrAdmin(admin, req);
    const { customerId, purpose = "followup", paymentId } = await req.json();
    if (!customerId || typeof customerId !== "string") return jsonResponse({ error: "customerId is required" }, 400);
    if (!PURPOSE_TASKS[purpose]) return jsonResponse({ error: "purpose must be payment | followup | nudge" }, 400);

    const apiKey = Deno.env.get("BLAND_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "ยังไม่ได้ตั้ง BLAND_API_KEY — เพิ่มใน Supabase Secrets ก่อน (ดู docs/SETUP.md หัวข้อ Voice Agent)" },
        400
      );
    }

    const { data: customer, error: cErr } = await admin
      .from("customers")
      .select("id, name, phone")
      .eq("id", customerId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!customer) return jsonResponse({ error: "customer not found" }, 404);
    if (!customer.phone) return jsonResponse({ error: "ลูกค้ารายนี้ไม่มีเบอร์โทร — เพิ่มเบอร์ในหน้าลูกค้าก่อน" }, 400);

    let amount: string | undefined;
    if (paymentId) {
      const { data: payment } = await admin.from("payments").select("amount").eq("id", paymentId).maybeSingle();
      if (payment) amount = Number(payment.amount).toLocaleString("th-TH");
    }

    const task = PURPOSE_TASKS[purpose]({ name: customer.name ?? "ลูกค้า", amount });
    const webhookUrl = `https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/voice-agent-webhook`;

    const resp = await fetch(BLAND_API, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: customer.phone,
        task,
        voice: Deno.env.get("BLAND_VOICE_ID") ?? "2djkd2hw5y6LrgK0cJmY",
        webhook: webhookUrl,
        metadata: { customerId: customer.id, purpose, paymentId, direction: "outbound" },
      }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return jsonResponse({ error: `Bland API error: ${result?.error ?? resp.status}` }, 502);
    }

    const callId = result?.call_id ?? null;
    const { error: logErr } = await admin.from("voice_call_logs").insert({
      direction: "outbound",
      phone: customer.phone,
      customer_id: customer.id,
      status: "calling",
      call_id: callId,
      summary: purpose === "payment" ? "โทรทวงชำระเงิน" : purpose === "nudge" ? "โทรแจ้งเตือนคาบเรียน" : "โทรติดตามลูกค้า",
      payment_id: paymentId ?? null,
      amount: amount ? Number(amount.replace(/,/g, "")) : null,
    });
    if (logErr) await logSystemEvent(admin, "voice-outbound", "error", `log insert: ${logErr.message}`);

    return jsonResponse({ callId, phone: customer.phone, status: "calling" }, 201);
  } catch (error) {
    return await handleUnexpectedError(admin, "voice-outbound", error);
  }
});
