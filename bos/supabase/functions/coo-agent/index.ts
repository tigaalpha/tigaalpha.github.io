import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push as linePush } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// COO Agent (Feature #4 + #9): twice a day the AI collects the business's
// numbers and exceptions and pushes one short, plain-text digest to the
// owner's LINE — revenue yesterday, new leads, pending payments, anything
// that needs a human decision. The owner reads it in seconds and only opens
// the app for the items that matter. Rules-based (no extra AI cost); the
// digest itself is written like a real assistant, not a bot.
Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    const ownerLineId = ownerRow?.value as string | undefined;
    if (!ownerLineId) return jsonResponse({ skipped: "owner_line_user_id not set" });

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
    const isoDay = dayStart.toISOString();
    const isoYesterday = yesterdayStart.toISOString();

    const [txRes, leadsRes, payRes, reviewRes, eventsRes, approvalsRes, kbRes, contentRes] = await Promise.all([
      admin.from("transactions").select("amount").eq("type", "income").gte("created_at", isoYesterday).lt("created_at", isoDay),
      admin.from("customers").select("id").gte("created_at", isoYesterday).lt("created_at", isoDay),
      admin.from("payments").select("amount").eq("status", "pending"),
      admin.from("conversations").select("id").eq("needs_review", true),
      admin.from("system_events").select("message").eq("severity", "error").gte("created_at", isoYesterday),
      admin.from("approval_requests").select("id").eq("status", "pending"),
      admin.from("kb_drafts").select("id").eq("status", "pending"),
      admin.from("content_calendar").select("id").eq("status", "draft"),
    ]);

    const income = (txRes.data ?? []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);
    const leads = leadsRes.data?.length ?? 0;
    const pendingPayments = payRes.data as { amount: number }[] | null;
    const pendingTotal = (pendingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const needsReview = reviewRes.data?.length ?? 0;
    const failedEvents = eventsRes.data as { message: string }[] | null;
    const approvals = approvalsRes.data?.length ?? 0;
    const kbDrafts = kbRes.data?.length ?? 0;
    const contentQueue = contentRes.data?.length ?? 0;

    const today = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
    const lines: string[] = [`📋 สรุปธุรกิจ ${today}`];

    const parts: string[] = [];
    parts.push(`รายได้เมื่อวาน ${income.toLocaleString("th-TH")} บาท · lead ใหม่ ${leads} ราย`);
    parts.push(`ใบแจ้งชำระค้าง ${(pendingPayments ?? []).length} ใบ รวม ${pendingTotal.toLocaleString("th-TH")} บาท`);
    if (needsReview > 0) parts.push(`แชทที่ AI ส่งให้ตรวจ ${needsReview} รายการ`);
    if (failedEvents && failedEvents.length > 0) {
      const sample = failedEvents.slice(0, 2).map((e) => e.message).join(" / ");
      parts.push(`⚠️ อัตโนมัติล้มเหลว ${failedEvents.length} ครั้ง — ${sample.slice(0, 120)}`);
    }
    if (approvals > 0) parts.push(`รออนุมัติ ${approvals} รายการ`);
    if (kbDrafts > 0) parts.push(`KB ร่างใหม่รออนุมัติ ${kbDrafts} ข้อ`);
    if (contentQueue > 0) parts.push(`คิวเนื้อหารอตรวจ ${contentQueue} ชิ้น`);

    lines.push(parts.join("\n"));

    // One concrete "what to do today" suggestion — rule-based priority.
    const todos: string[] = [];
    if (pendingTotal > 0) todos.push(`เช็คยอดโอนในแอปธนาคาร แล้วกดยืนยันเงินเข้าในหน้า การชำระเงิน`);
    if (needsReview > 0) todos.push(`ตอบแชทที่ AI ส่งให้ตรวจ (หน้า Inbox)`);
    if (approvals > 0) todos.push(`กดอนุมัติงานที่ค้าง (หน้า การอนุมัติ)`);
    if (kbDrafts > 0) todos.push(`อนุมัติคำตอบใหม่ใน Knowledge Base`);
    if (failedEvents && failedEvents.length > 0) todos.push(`ดู System Health — มีงานอัตโนมัติล้มเหลว`);
    if (todos.length > 0) {
      lines.push("");
      lines.push(`สิ่งที่ควรทำวันนี้: ${todos.slice(0, 3).join(" · ")}`);
    }
    if (parts.length === 1) lines.push("วันนี้เงียบๆ ไม่มีอะไรต้องรีบทำค่ะ");

    await linePush(ownerLineId, lines.join("\n"));
    return jsonResponse({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "coo-agent", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
