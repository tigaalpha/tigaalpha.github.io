import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { CHAT_FEATURE_KEYS, CHAT_FEATURE_LABELS, isFeatureEnabled } from "../_shared/chat-features.ts";

// งานแชท #5 — ความจำลูกค้าระยะยาว: ทุกคืน 03:00 BKK สแกนบทสนทนาของวัน
// (ที่ไม่ใช่ internal) สรุปข้อเท็จจริงสำคัญของลูกค้า (ชื่อลูก ระดับ ความชอบ
// ข้อแม้ ฯลฯ) แล้วผนวกเข้า customers.notes + อัปเดต conversations.summary
// — ครั้งหน้าที่ลูกค้าทักมา AI จะรู้จักเขาตั้งแต่ประโยคแรก (notes ถูกส่งเข้า
// prompt ผ่าน lookup_customer/update_customer_profile แล้ว)
// หมายเหตุ: เขียนเฉพาะ notes ภายใน (เจ้าของแก้ได้ใน CRM) — ไม่มีข้อความ
// ออกไปหาลูกค้า จึงไม่ต้องผ่าน outbox
Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: flagRows } = await admin.from("integration_settings").select("key, value");
    const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;
    if (!isFeatureEnabled(flags, "customerMemory")) {
      return jsonResponse({ skipped: "feature disabled" });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // คอนเวอร์เซชันที่คุยกันวันนี้ (>= 4 ข้อความ) ยังไม่ได้สรุป
    const { data: conversations } = await admin
      .from("conversations")
      .select("id, customer_id, summary")
      .not("customer_id", "is", null)
      .neq("channel", "internal")
      .gte("updated_at", since)
      .limit(20);

    const existing = await admin
      .from("ai_outbox")
      .select("reference_id")
      .eq("feature", "customer_memory")
      .gte("created_at", since);
    const done = new Set((existing.data ?? []).map((r) => r.reference_id));

    let summarized = 0;
    for (const conv of conversations ?? []) {
      const ref = `memory:${conv.id}`;
      if (done.has(ref)) continue;

      const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id);
      if ((count ?? 0) < 4) continue;

      const { data: messages } = await admin
        .from("messages")
        .select("sender, content")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const history = [...(messages ?? [])].reverse()
        .map((m) => `${m.sender}: ${m.content.slice(0, 250)}`)
        .join("\n");

      const res = await generate([
        {
          role: "user",
          content: [
            "จากบทสนทนากับลูกค้าโรงเรียนสอนเปียโน จงสรุปข้อเท็จจริงที่ควรจำ (ชื่อลูก, อายุ/ระดับ, เวลาที่สะดวก, ความชอบ, ข้อแม้, สิ่งที่คุยค้างไว้) เป็นภาษาไทย สั้น กระชับ ไม่เกิน 100 คำ",
            conv.summary ? `summary เดิม: ${conv.summary.slice(0, 300)}` : null,
            "บทสนทนา:",
            history,
          ].filter(Boolean).join("\n"),
        },
      ], undefined, 0.3, 300);

      const facts = (res.text ?? "").trim();
      if (!facts) continue;

      const { data: customer } = await admin.from("customers").select("id, name, notes").eq("id", conv.customer_id).maybeSingle();
      if (customer) {
        const stamp = `🧠 AI (${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date())}): ${facts}`;
        const existingNotes = customer.notes ?? "";
        const nextNotes = existingNotes ? `${existingNotes}\n${stamp}` : stamp;
        await admin.from("customers").update({ notes: nextNotes.slice(-3000) }).eq("id", customer.id);
      }

      await admin.from("conversations").update({ summary: (conv.summary ? `${conv.summary}\n` : "") + facts.slice(0, 1500) }).eq("id", conv.id);
      await admin.from("ai_outbox").insert({
        feature: "customer_memory",
        status: "sent",
        mode: "auto",
        channel: "internal",
        customer_id: conv.customer_id,
        recipient_line_user_id: null,
        message: `สรุปความจำลูกค้า: ${facts.slice(0, 200)}`,
        reason: "สรุปอัตโนมัติจากบทสนทนาของวัน",
        reference_id: ref,
      });
      summarized++;
    }

    await logSystemEvent(admin, "chat-memory-sync", "info", `memory-sync: สรุป ${summarized} คอนเวอร์เซชัน`);
    return jsonResponse({ summarized, feature: CHAT_FEATURE_LABELS.customerMemory });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-memory-sync", error);
  }
});
