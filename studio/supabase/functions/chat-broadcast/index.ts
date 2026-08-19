import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { CHAT_FEATURE_KEYS, CHAT_FEATURE_LABELS, isFeatureEnabled, DAILY_LIMITS } from "../_shared/chat-features.ts";

// งานแชท #8 — Broadcast: เจ้าของเขียนข้อความโปรโมชัน → ระบบสร้างคิวข้อความ
// ถึงลูกค้า LINE ทุกคน (ข้ามคนที่ขอเลิกแจ้ง) ผ่าน ai_outbox:
//   - ค่าเริ่มต้น: pending_review ให้เจ้าของเห็นจำนวนผู้รับและอนุมัติใน Inbox
//   - ส่งตรงได้ถ้าส่ง sendNow=true (ตัวเลือกใน UI)
// วงเงิน: 1 ครั้ง/วัน (กันส่งพลาด)
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireStaff(admin, req);

    const { message, sendNow } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) return jsonResponse({ error: "message is required" }, 400);
    const text = message.trim();
    if (text.length > 2000) return jsonResponse({ error: "ข้อความยาวเกิน 2000 ตัวอักษร" }, 400);

    const { data: flagRows } = await admin.from("integration_settings").select("key, value");
    const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;
    if (!isFeatureEnabled(flags, "broadcast")) return jsonResponse({ error: "ฟีเจอร์ Broadcast ถูกปิดอยู่ — เปิดได้ใน Settings" }, 400);

    // วงเงิน 1 ครั้ง/วัน
    const dayStart = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await admin
      .from("ai_outbox")
      .select("id", { count: "exact", head: true })
      .eq("feature", "broadcast")
      .gte("created_at", dayStart);
    if ((todayCount ?? 0) >= DAILY_LIMITS.broadcast) {
      return jsonResponse({ error: "ส่ง Broadcast ได้ 1 ครั้ง/วัน — ลองใหม่พรุ่งนี้" }, 429);
    }

    const { data: recipients } = await admin
      .from("customers")
      .select("id, name, line_user_id")
      .not("line_user_id", "is", null)
      .eq("marketing_opt_out", false)
      .limit(200);

    const list = recipients ?? [];
    if (list.length === 0) return jsonResponse({ error: "ยังไม่มีลูกค้า LINE ที่รับข้อความได้ (เปิดรับข่าวสาร)" }, 400);

    const ref = `broadcast:${new Date().toISOString().slice(0, 16)}`;
    const rows = list.map((c) => ({
      feature: "broadcast",
      status: sendNow ? "approved" : "pending_review",
      mode: sendNow ? "auto" : "suggest",
      channel: "line",
      customer_id: c.id,
      recipient_line_user_id: c.line_user_id!,
      message: text,
      reason: `Broadcast โดย ${userId} — ถึงลูกค้า LINE ${list.length} คน`,
      reference_id: ref,
    }));

    const { data: inserted, error } = await admin.from("ai_outbox").insert(rows).select("id");
    if (error) throw error;

    let sent = 0;
    if (sendNow) {
      for (const row of inserted ?? []) {
        const target = list.find((c) => c.id === row.customer_id);
        if (!target?.line_user_id) continue;
        try {
          await push(target.line_user_id, text);
          sent++;
          await admin.from("ai_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        } catch (err) {
          // ลูกค้าบางคนอาจบล็อก — ข้าม ไม่ล้มทั้ง batch
          await admin.from("ai_outbox").update({ status: "failed", error: String(err) }).eq("id", row.id);
        }
      }
    }

    await logSystemEvent(admin, "chat-broadcast", "info", `Broadcast "${text.slice(0, 60)}" → ${list.length} คน (${sendNow ? `ส่งตรง ${sent}/${list.length}` : "รออนุมัติ"})`);
    return jsonResponse({
      queued: (inserted ?? []).length,
      recipients: list.length,
      status: sendNow ? (sent > 0 ? "sent" : "failed_partial") : "pending_review",
      preview: text.slice(0, 120),
      feature: CHAT_FEATURE_LABELS.broadcast,
    });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-broadcast", error);
  }
});
