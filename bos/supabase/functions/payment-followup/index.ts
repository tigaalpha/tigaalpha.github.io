import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push as linePush } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Stage-based payment followups (Feature #5): a pending invoice gets a
// polite LINE nudge after 24h, a second after 72h, and a third after 7
// days — after which the owner is alerted personally. Never pushy, always
// leaves the door open ("ถ้าโอนแล้วส่งสลิปมาได้เลย / มีข้อสงสัยทักได้ตลอด").
const STAGES = [
  { afterMs: 24 * 60 * 60 * 1000, message: "สวัสดีค่ะ ยังไม่เห็นการโอนเงินสำหรับใบแจ้งชำระ (อ้างอิง {ref}) จำนวน {amount} บาทนะคะ ถ้าโอนเรียบร้อยแล้วรบกวนส่งสลิปในแชทนี้ได้เลยค่ะ ทางเราจะยืนยันให้ทันทีค่ะ 😊" },
  { afterMs: 72 * 60 * 60 * 1000, message: "สวัสดีค่ะ ตามใบแจ้งชำระ (อ้างอิง {ref}) จำนวน {amount} บาท อีกครั้งนะคะ ไม่ต้องรีบ แต่ถ้ามีข้อสงสัยหรือสะดวกชำระวันไหน ทักมาได้ตลอดเลยค่ะ" },
  { afterMs: 7 * 24 * 60 * 60 * 1000, message: "สวัสดีค่ะ รบกวนเช็คใบแจ้งชำระ (อ้างอิง {ref}) จำนวน {amount} บาท ด้วยนะคะ ถ้ามีเหตุขัดข้องหรืออยากปรับแผนการชำระ บอกได้เลยค่ะ เรายินดีช่วยเหลือค่ะ" },
];
const MAX_PER_RUN = 10;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const now = Date.now();
    const { data: pending } = await admin
      .from("payments")
      .select("id, customer_id, amount, reference_code, remind_count, last_reminded_at, created_at, customers(line_user_id, name, phone)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    if (!pending) return jsonResponse({ reminded: 0 });

    const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    const ownerLineId = ownerRow?.value as string | undefined;

    let reminded = 0;
    let escalated = 0;

    for (const payment of pending) {
      if (reminded >= MAX_PER_RUN) break;
      const customer = Array.isArray(payment.customers) ? payment.customers[0] : payment.customers;
      const lineUserId = customer?.line_user_id as string | undefined;
      const count = payment.remind_count ?? 0;
      const stage = STAGES[count];
      if (!stage) {
        // Already at the final stage — the owner was alerted last time.
        continue;
      }
      const age = now - new Date(payment.created_at).getTime();
      if (age < stage.afterMs) continue;

      const amount = Number(payment.amount).toLocaleString("th-TH");
      const message = stage.message.replace("{ref}", payment.reference_code).replace("{amount}", amount);

      if (lineUserId) {
        try {
          await linePush(lineUserId, message);
          reminded += 1;
        } catch {
          // Customer blocked the OA — nothing to do, the invoice still stands.
        }
      }

      await admin.from("payments").update({ remind_count: count + 1, last_reminded_at: new Date().toISOString() }).eq("id", payment.id);

      if (count + 1 >= STAGES.length && ownerLineId) {
        // Final reminder sent (or customer unreachable) — the owner should
        // take over personally.
        try {
          await linePush(ownerLineId, `💰 ใบแจ้งชำระค้างเกิน 7 วัน: ${customer?.name ?? "ลูกค้า"} (${payment.reference_code}) ${amount} บาท — รบกวนติดต่อเองค่ะ`);
          escalated += 1;
        } catch {
          // owner unreachable — the Payments page still surfaces it
        }
      }

      // 7-day overdue + customer has a phone + Bland AI is configured:
      // escalate with a real outbound voice call (feature #1). Guarded — if
      // anything fails or the key is missing, the cron keeps running.
      if (count + 1 >= STAGES.length && customer?.phone) {
        try {
          const apiKey = Deno.env.get("BLAND_API_KEY");
          if (apiKey) {
            await fetch("https://api.bland.ai/v1/calls", {
              method: "POST",
              headers: { Authorization: apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                phone_number: customer.phone,
                task:
                  `คุณกำลังโทรหา${customer?.name ?? "ลูกค้า"} ของโรงเรียนสอนเปียโน TIGA Studio พูดภาษาไทยสุภาพเหมือนพนักงานจริง ` +
                  `แจ้งว่ามีใบแจ้งชำระ ${amount} บาท (อ้างอิง ${payment.reference_code}) ที่ยังไม่ได้รับเงิน ` +
                  `สอบถามว่าสะดวกโอนเมื่อไหร่ ถ้าโอนแล้วขอบคุณและบอกว่าจะตรวจสลิปให้เร็วที่สุด พูดสั้นกระชับ ไม่กดดัน`,                
                voice: Deno.env.get("BLAND_VOICE_ID") ?? "2djkd2hw5y6LrgK0cJmY",
                webhook: "https://tzgktczefypwhhmyxlmj.supabase.co/functions/v1/voice-agent-webhook",
                metadata: { customerId: payment.customer_id, purpose: "payment", paymentId: payment.id, direction: "outbound" },
              }),
            }).catch(() => {});
          }
        } catch {
          // never let a voice call failure break the reminder cron
        }
      }
    }

    if (reminded > 0 || escalated > 0) {
      await logSystemEvent(admin, "payment-followup", "info", `reminded ${reminded}, escalated ${escalated}`);
    }
    return jsonResponse({ reminded, escalated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "payment-followup", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
