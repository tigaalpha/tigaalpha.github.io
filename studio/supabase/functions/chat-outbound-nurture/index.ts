import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { push } from "../_shared/line.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import {
  CHAT_FEATURE_KEYS,
  CHAT_FEATURE_LABELS,
  isFeatureEnabled,
  reviewModeIsAuto,
  isWithinBusinessHours,
  DAILY_LIMITS,
} from "../_shared/chat-features.ts";

// งานแชท #1 — Outbound Nurture: ลูกค้าถามแล้วเงียบเกิน 24 ชม. (ยังไม่เกิน 72)
// AI ร่างข้อความถามต่อเป็นรายบุคคล แล้วเข้าคิว ai_outbox:
//   - โหมด review "always" (ค่าเริ่มต้น): รอเจ้าของตรวจ/แก้/อนุมัติใน Inbox
//   - โหมด "auto": ส่ง LINE ตรงทันที (เฉพาะเวลาทำการ + วงเงินต่อวัน)
// เหตุผลที่ปฏิเสธ (chat_feedback) จะถูกดึงมาสอน prompt รอบถัดไป
Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: flagRows } = await admin.from("integration_settings").select("key, value");
    const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;

    if (!isFeatureEnabled(flags, "outboundNurture")) {
      return jsonResponse({ skipped: "feature disabled" });
    }
    const auto = reviewModeIsAuto(flags);
    const now = new Date();
    const inBusinessHours = isWithinBusinessHours(now);

    // วงเงินต่อวัน (ทั้งสองโหมด): นับที่สร้างไปวันนี้
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { count: sentToday } = await admin
      .from("ai_outbox")
      .select("id", { count: "exact", head: true })
      .eq("feature", "outbound_nurture")
      .gte("created_at", dayStart);
    const dailyLimit = DAILY_LIMITS.outbound_nurture;
    const overDailyLimit = (sentToday ?? 0) >= dailyLimit;

    // Candidate: ลูกค้าที่คุยกันแล้วเงียบ 24–72 ชม. (ข้อความสุดท้าย = ลูกค้า)
    const { data: candidates } = await admin
      .from("conversations")
      .select(
        "id, customer_id, customers(name, line_user_id, sales_status, lead_score, marketing_opt_out, notes)"
      )
      .in("channel", ["line", "web"])
      .not("customer_id", "is", null)
      .in("customers.sales_status", [
        "new_lead", "contacted", "qualified", "interested", "trial_booked",
        "negotiating", "waiting_decision", "renew_pending",
      ]);

    const lastMsgAt = new Map<string, Date>();
    for (const conv of candidates ?? []) {
      const { data: last } = await admin
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conv.id)
        .eq("sender", "customer")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) lastMsgAt.set(conv.id, new Date(last.created_at));
    }

    // Dedupe: อย่าร่างซ้ำถ้าเคยร่าง/sent ให้คอนเวอร์เซชันนี้ใน 7 วัน
    const recent = await admin
      .from("ai_outbox")
      .select("reference_id")
      .eq("feature", "outbound_nurture")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    const recentlyNurtured = new Set((recent.data ?? []).map((r) => r.reference_id));

    // คำสอนล่าสุด (เหตุผลปฏิเสธ) — สอน AI ไม่ให้พลาดซ้ำ
    const { data: feedback } = await admin
      .from("chat_feedback")
      .select("note, original_message")
      .eq("feature", "outbound_nurture")
      .eq("feedback_type", "rejected")
      .order("created_at", { ascending: false })
      .limit(5);
    const teachingNotes = (feedback ?? [])
      .filter((f) => f.note)
      .map((f) => `- ${f.note}${f.original_message ? ` (ข้อความเดิม: "${f.original_message.slice(0, 120)}")` : ""}`)
      .join("\n");

    let drafted = 0;
    let sent = 0;
    for (const conv of candidates ?? []) {
      if (drafted >= 3) break; // รอบละไม่เกิน 3 ร่าง กันสแปม
      const lastAt = lastMsgAt.get(conv.id);
      if (!lastAt) continue;
      const hoursSince = (now.getTime() - lastAt.getTime()) / 36e5;
      if (hoursSince < 24 || hoursSince > 72) continue;
      const cust = (conv as { customers: { name: string; line_user_id: string | null; sales_status: string; lead_score: number | null; marketing_opt_out: boolean; notes: string | null } | null }).customers;
      if (!cust?.line_user_id || cust.marketing_opt_out) continue;

      const ref = `conv:${conv.id}`;
      if (recentlyNurtured.has(ref)) continue;

      const prompt = [
        "คุณคือเจ้าของโรงเรียนสอนเปียโน กำลังเขียนข้อความ LINE ตามลูกค้าที่เคยคุยแล้วเงียบไป",
        `ลูกค้า: ${cust.name}`,
        `สถานะ: ${cust.sales_status} (คะแนน lead: ${cust.lead_score ?? "?"})`,
        cust.notes ? `บันทึกที่มี: ${cust.notes.slice(0, 400)}` : null,
        "ข้อความที่ผ่านมาเจ้าของปฏิเสธ (ห้ามทำแบบนี้ซ้ำ):",
        teachingNotes || "ไม่มี",
        "เขียนข้อความทักทายสั้นๆ 1 ย่อหน้า (ไม่เกิน 100 คำ) ภาษาไทย กระชับ อบอุ่น เป็นธรรมชาติเหมือนเจ้าของร้านพิมพ์เอง ไม่ขายของแรง ไม่ถามว่า 'สนใจไหม' ตรงๆ ควรอ้างอิงสิ่งที่เคยคุยกันแล้ว",
      ].filter(Boolean).join("\n");

      const res = await generate([{ role: "user", content: prompt }], undefined, 0.7, 300);
      const message = (res.text ?? "").trim().replace(/\s+/g, " ");
      if (!message) continue;

      const mode = auto ? "auto" : "suggest";
      const status = auto && inBusinessHours && !overDailyLimit ? "approved" : "pending_review";
      const { error } = await admin.from("ai_outbox").insert({
        feature: "outbound_nurture",
        status,
        mode,
        channel: "line",
        customer_id: conv.customer_id,
        recipient_line_user_id: cust.line_user_id,
        message,
        reason: `ลูกค้าเงียบ ${Math.round(hoursSince)} ชม. หลังคุยกันล่าสุด (สถานะ ${cust.sales_status})`,
        reference_id: ref,
      });
      if (error) throw error;
      drafted++;

      if (status === "approved") {
        try {
          await push(cust.line_user_id, message);
          await admin.from("ai_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("reference_id", ref);
          sent++;
        } catch (err) {
          await admin.from("ai_outbox").update({ status: "failed", error: String(err) }).eq("reference_id", ref);
        }
      }
    }

    const summary = `chat-outbound-nurture: ร่าง ${drafted} ข้อความ${auto ? ` (auto mode, ส่งแล้ว ${sent})` : " (รออนุมัติ)"}`;
    await logSystemEvent(admin, "chat-outbound-nurture", "info", summary);
    return jsonResponse({ drafted, sent, mode: auto ? "auto" : "suggest", feature: CHAT_FEATURE_LABELS.outboundNurture });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-outbound-nurture", error);
  }
});
