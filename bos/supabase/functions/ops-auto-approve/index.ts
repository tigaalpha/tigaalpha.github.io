// ops-auto-approve — the one-person org's bottleneck remover. Daily cron
// that approves low-risk AI work the owner would approve anyway:
//   1. KB drafts produced by the eval-correction loop (source_conversation_id
//      set — these are AI fixes for real failing replies, so they're the
//      highest-confidence drafts in the queue).
//   2. Content calendar items that are due within 2 days and already have a
//      body (letting them sit as drafts means they silently miss their
//      publish window).
// Everything approved is reported to the owner on LINE the same morning,
// together with what is still waiting for a human decision, so autonomy
// never becomes invisibility.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { approveKbDraft } from "../_shared/kb-drafts.ts";
import { push } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const MAX_KB_PER_RUN = 3;
const MAX_CONTENT_PER_RUN = 3;
const CONTENT_APPROVE_AHEAD_DAYS = 2;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: ownerProfile } = await admin.from("profiles").select("id").eq("role", "owner").limit(1).maybeSingle();
    const ownerId = ownerProfile?.id ?? null;

    // 1) KB drafts from the eval-correction loop — auto-approve.
    let kbApproved = 0;
    const { data: drafts } = await admin
      .from("kb_drafts")
      .select("id, question")
      .eq("status", "pending")
      .not("source_conversation_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(MAX_KB_PER_RUN);
    for (const draft of (drafts ?? []) as { id: string; question: string }[]) {
      try {
        await approveKbDraft(admin, draft.id, ownerId);
        kbApproved += 1;
      } catch (e) {
        await logSystemEvent(admin, "ops-auto-approve", "error", `kb draft ${draft.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2) Content due within 2 days with a real body — auto-approve so the
    // hourly content-publish cron can queue it.
    let contentApproved = 0;
    const horizon = new Date(Date.now() + CONTENT_APPROVE_AHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: dueContent } = await admin
      .from("content_calendar")
      .select("id, title, planned_date, body")
      .eq("status", "draft")
      .lte("planned_date", horizon)
      .order("planned_date", { ascending: true })
      .limit(MAX_CONTENT_PER_RUN);
    for (const item of (dueContent ?? []) as { id: string; title: string; body?: string | null }[]) {
      if (!item.body?.trim()) continue;
      await admin.from("content_calendar").update({ status: "approved" }).eq("id", item.id);
      contentApproved += 1;
    }

    // 3) What still needs a human decision.
    const { count: kbWaiting } = await admin.from("kb_drafts").select("id", { count: "exact", head: true }).eq("status", "pending");
    const { count: contentWaiting } = await admin.from("content_calendar").select("id", { count: "exact", head: true }).eq("status", "draft");

    if (kbApproved > 0 || contentApproved > 0) {
      await logSystemEvent(admin, "ops-auto-approve", "info", `auto-approved ${kbApproved} KB drafts, ${contentApproved} content`);
      const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
      if (ownerRow?.value) {
        const lines: string[] = ["🤖 AI อนุมัติงานเองแล้ววันนี้:"];
        if (kbApproved > 0) lines.push(`- คำตอบ KB ใหม่ ${kbApproved} ชิ้น (จากคำตอบที่ AI ตอบผิด) เข้าฐานความรู้แล้ว`);
        if (contentApproved > 0) lines.push(`- คอนเทนต์ ${contentApproved} ชิ้นที่ถึงกำหนด อนุมัติเข้ารอบโพสต์แล้ว`);
        lines.push(`ยังรอคุณตัดสินใจ: KB ${kbWaiting ?? 0} ชิ้น, คอนเทนต์ ${contentWaiting ?? 0} ชิ้น — พิมพ์ "คิวค้าง" ในแชทนี้เพื่อดู/จัดการ`);
        await push(ownerRow.value, lines.join("\n")).catch(() => {});
      }
    }

    return jsonResponse({ kbApproved, contentApproved, kbWaiting: kbWaiting ?? 0, contentWaiting: contentWaiting ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "ops-auto-approve", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
