import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push } from "../_shared/line.ts";
import { bangkokDayStartIso } from "../_shared/agent-actions-db.ts";

// งาน #1 (Autonomy Tier 2) — สรุปงานประจำวันของทีม AI: ทุกเช้า 07:30 (BKK)
// เจ้าของจะได้ LINE digest ว่าวันก่อน AI ทำอะไรไปบ้างแบบอัตโนมัติ และมีอะไร
// รออนุมัติอยู่ — "AI ทำแล้วค่อยรายงาน" จะโปร่งใสได้ก็ต่อเมื่อมีรายงานนี้
Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const dayStart = bangkokDayStartIso();
    const today = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

    const [doneRes, pendingRes] = await Promise.all([
      admin
        .from("agent_actions")
        .select("id, title, action_type")
        .in("status", ["auto_executed", "executed"])
        .gte("executed_at", dayStart)
        .order("executed_at", { ascending: false })
        .limit(25),
      admin
        .from("agent_actions")
        .select("id, title, priority, action_type")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (doneRes.error) throw doneRes.error;
    if (pendingRes.error) throw pendingRes.error;

    const done = doneRes.data ?? [];
    const pending = pendingRes.data ?? [];

    const actionLabel: Record<string, string> = {
      create_task: "สร้างงาน",
      send_notification: "แจ้งเตือน",
      send_line: "ส่ง LINE",
      create_schedule: "จัดตาราง",
      draft_content: "ร่างคอนเทนต์",
      update_customer: "อัปเดตลูกค้า",
      send_email: "ส่งอีเมล",
    };

    const lines: string[] = [];
    lines.push(`🤖 สรุปงาน AI · ${today}`);
    lines.push("");
    if (done.length === 0) {
      lines.push("✅ เมื่อวาน AI ไม่ได้ลงมือทำอะไร");
    } else {
      lines.push(`✅ AI ทำแล้วอัตโนมัติ ${done.length} รายการ:`);
      for (const a of done) lines.push(`  • ${actionLabel[a.action_type] ?? a.action_type} — ${a.title}`);
    }
    lines.push("");
    if (pending.length === 0) {
      lines.push("⏳ ไม่มีงานรออนุมัติ");
    } else {
      const high = pending.filter((a) => a.priority === "high").length;
      lines.push(`⏳ รออนุมัติ ${pending.length} รายการ${high > 0 ? ` (เร่งด่วน ${high})` : ""}:`);
      for (const a of pending) lines.push(`  • [${a.priority === "high" ? "เร่งด่วน" : a.priority}] ${a.title}`);
      lines.push("");
      lines.push("เปิด BOS → หน้า AI Company เพื่ออนุมัติ/ปฏิเสธ");
    }

    const text = lines.join("\n");

    const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerRow?.value) {
      try {
        await push(ownerRow.value, text);
      } catch {
        // LINE may be down — dashboard notification below is the record
      }
    }

    await admin.from("notifications").insert({
      type: "agent_action_digest",
      title: `สรุปงาน AI · ${today}`,
      body: `ทำแล้ว ${done.length} · รออนุมัติ ${pending.length}`,
    });

    return jsonResponse({ done: done.length, pending: pending.length });
  } catch (error) {
    console.error("agent-action-digest failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" }, 500);
  }
});
