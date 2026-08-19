import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { geminiProvider } from "../_shared/gemini.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

// Feature #6 — AI answer quality eval. Daily cron samples up to 10 recent
// AI replies from customer channels (LINE/web/Messenger — not the owner's
// internal assistant), scores each 1-5 with an LLM judge, and stores the
// result in ai_evals. The /ai-quality page turns this into a trend line +
// violation list, so "is the AI getting better?" has a number.
//
// Quality loop (eval → correction → KB): when a reply scores <= 2, the
// failing question is turned into a kb_draft correction — the model
// re-answers it properly, the owner approves the draft in Knowledge >
// ฉบับร่าง KB, and it becomes real knowledge so the failure doesn't repeat.
const SAMPLE_LIMIT = 10;
const SAMPLE_WINDOW_HOURS = 48;

const CORRECTION_PROMPT = (question: string, badReply: string, reason: string) =>
  [
    "คุณเป็นพนักงานโรงเรียนสอนเปียโน TIGA Studio เขียนคำตอบใหม่ให้คำถามนี้ให้ดีกว่าเดิม",
    "คำตอบเดิมถูกให้คะแนนต่ำเพราะ:",
    reason,
    "กฎ: ตอบเหมือนคน พูดสุภาพเป็นธรรมชาติ ไม่มีเครื่องหมายพิเศษ ไม่มี list ไม่พูดถึงระบบหรือข้อผิดพลาดภายใน",
    "ถ้าตอบไม่ได้จริง ให้แนะนำให้ติดต่อเจ้าของร้าน",
    "คำถามลูกค้า:",
    question,
    "คำตอบเดิมที่ไม่ดี:",
    badReply.slice(0, 400),
    "เขียนคำตอบใหม่ (2-4 ประโยค ภาษาไทย):",
  ].join("\n");

const JUDGE_PROMPT = (reply: string) =>
  [
    "คุณเป็นหัวหน้าทีมตรวจคุณภาพการตอบของแชทบอทของโรงเรียนสอนเปียโน ให้คะแนนคำตอบ 1-5",
    "เกณฑ์:",
    "5 = ธรรมชาติเหมือนมนุษย์ ตอบตรงคำถาม ชัดเจน ไม่มีเครื่องหมายพิเศษ",
    "4 = ดี แต่มีจุดที่ปรับได้เล็กน้อย",
    "3 = พอใช้ แต่ดูเป็นสูตรสำเร็จ หรือตอบไม่ตรงประเด็นเต็มที่",
    "2 = ไม่ดี: ใช้เครื่องหมายพิเศษ (**, ~~, !!, -, bullet), ตอบผิด/ไม่เกี่ยวข้อง, หรือทักทายซ้ำแบบสูตรสำเร็จ (เช่น 'ยินดีต้อนรับ... อีกครั้ง') โดยไม่ตอบคำถาม",
    "1 = แย่มาก: มีขีดฆ่าข้อความ ใช้สัญลักษณ์เยอะ หรือตอบไม่เกี่ยวกับคำถาม",
    "ตอบเป็น JSON ล้วนเท่านั้น ห้ามมีข้อความอื่นนอก JSON ใช้ double quotes เท่านั้น (ห้าม single quotes): {\"score\": 1-5, \"reason\": \"คำอธิบายสั้นๆ ภาษาไทย 1 ประโยค\"}",
    "คำตอบที่จะตรวจ:",
    reply.slice(0, 800),
  ].join("\n");

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const since = new Date(Date.now() - SAMPLE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: samples, error } = await admin
      .from("messages")
      .select("id, conversation_id, content, metadata, conversations(channel)")
      .eq("sender", "ai")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    const candidates = (samples ?? []).filter((m) => {
      const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
      if (!conv?.channel || conv.channel === "internal") return false;
      const meta = (m.metadata ?? {}) as { cached?: boolean; fallback?: boolean; tool_call?: boolean };
      if (meta.cached || meta.fallback || meta.tool_call) return false;
      return (m.content ?? "").trim().length > 10;
    });

    const toEval = candidates.slice(0, SAMPLE_LIMIT);
    let evaluated = 0;
    for (const m of toEval as { id: string; conversation_id: string; content: string; conversations?: { channel?: string } | null }[]) {
      try {
        const result = await geminiProvider.generate([{ role: "user", content: JUDGE_PROMPT(m.content) }], undefined, 0.1, 400);
        const raw = (result.message.content ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");

        // Lenient parse: the judge sometimes wraps in fences or uses single
        // quotes — extract the score with a regex rather than strict JSON.
        const scoreMatch = raw.match(/(?:["']?score["']?)\s*[:：]\s*(\d)/i);
        if (!scoreMatch) continue;
        const score = Number(scoreMatch[1]);
        if (!Number.isFinite(score) || score < 1 || score > 5) continue;
        const reasonMatch = raw.match(/(?:["']?reason["']?)\s*[:：]\s*["']([^"']+)["']/i);
        const reason = reasonMatch ? reasonMatch[1].slice(0, 500) : null;
        await admin.from("ai_evals").insert({
          message_id: m.id,
          conversation_id: m.conversation_id,
          channel: (Array.isArray(m.conversations) ? m.conversations[0] : m.conversations)?.channel ?? null,
          reply_text: m.content.slice(0, 1000),
          score: Math.round(score),
          reason,
          model: "gemini-judge",
        });
        evaluated += 1;

        // eval → correction → KB: a failing reply (score <= 2) becomes a
        // kb_draft with the model's own improved answer, so the owner can
        // approve it into the knowledge base with one tap instead of the
        // same failure repeating for the next customer.
        if (score <= 2) {
          try {
            const { data: qRes } = await admin
              .from("messages")
              .select("content")
              .eq("conversation_id", m.conversation_id)
              .eq("sender", "customer")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const question = qRes?.content ? String(qRes.content).slice(0, 300) : null;
            if (question) {
              const corrected = await geminiProvider.generate([{ role: "user", content: CORRECTION_PROMPT(question, m.content, reason ?? "ตอบไม่ดี") }], undefined, 0.3, 500);
              await logAiUsage(admin, corrected.usage, "ai-eval-runner:correction");
              const newAnswer = (corrected.message.content ?? "").trim();
              if (newAnswer && !/^```/.test(newAnswer)) {
                const { error: draftErr } = await admin.from("kb_drafts").insert({
                  question,
                  draft_answer: newAnswer.slice(0, 1000),
                  source_conversation_id: m.conversation_id,
                });
                if (draftErr) throw draftErr;
                await admin.from("notifications").insert({
                  type: "kb_draft_ready",
                  title: "AI ตรวจพบคำตอบไม่ดี — มีฉบับแก้ให้อนุมัติ",
                  body: `คำถาม: ${question.slice(0, 120)} — ไปที่หน้า Knowledge → ฉบับร่าง KB เพื่ออนุมัติคำตอบใหม่`,
                });
              }
            }
          } catch (e) {
            await logSystemEvent(admin, "ai-eval-runner", "error", `kb correction for ${m.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } catch (e) {
        await logSystemEvent(admin, "ai-eval-runner", "error", `eval ${m.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (evaluated > 0) await logSystemEvent(admin, "ai-eval-runner", "info", `evaluated ${evaluated}`);
    return jsonResponse({ evaluated, scanned: candidates.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "ai-eval-runner", error);
  }
});
