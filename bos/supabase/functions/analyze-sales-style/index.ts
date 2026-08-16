import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";

interface ChatTurn {
  speaker: "customer" | "owner";
  text: string;
}

const PLAYBOOK_SYSTEM_PROMPT = `You analyze real closed-sale chat transcripts from a piano school owner and distill the owner's actual selling technique into a reusable playbook for an AI sales assistant to imitate. Look across ALL the transcripts given, find the patterns that repeat (not one-off phrasing), and write a concise playbook covering: how the owner opens a conversation, the order and phrasing of qualifying questions, exact phrases/approach used for each type of objection you see (price, timing, comparing schools, needing to ask family, etc.), the signals the owner uses to know it's time to push for a close, and the overall tone (formality, warmth, emoji use, sentence length). Write it as direct instructions to the AI ("Open by...", "When the customer says X, respond with..."), grounded in what you actually observed -- do not invent generic sales advice not evidenced in the transcripts. Output plain Markdown, no preamble.`;

function transcriptText(turns: ChatTurn[]): string {
  return turns.map((t) => `[${t.speaker}] ${t.text}`).join("\n");
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "analyze-sales-style", { windowMinutes: 60, maxRequests: 5 });

    const { data: examples, error: examplesError } = await admin
      .from("sales_chat_examples")
      .select("id, extracted_turns")
      .eq("confirmed", true)
      .order("created_at", { ascending: true });
    if (examplesError) throw examplesError;

    if (!examples || examples.length === 0) {
      return jsonResponse({ error: "ยังไม่มีตัวอย่างแชทที่ยืนยันแล้วเลย อัปโหลดและยืนยันอย่างน้อย 1 ภาพก่อน" }, 400);
    }

    const transcripts = examples.map((e, i) => `--- ตัวอย่างที่ ${i + 1} ---\n${transcriptText(e.extracted_turns as unknown as ChatTurn[])}`);
    const combined = transcripts.join("\n\n");

    const result = await generate(
      [
        { role: "system", content: PLAYBOOK_SYSTEM_PROMPT },
        { role: "user", content: combined },
      ],
      undefined,
      0.4,
      2048,
      "content"
    );
    await logAiUsage(admin, result.usage, "analyze-sales-style");
    const playbook = result.message.content;
    if (!playbook) {
      return jsonResponse({ error: "AI สรุปเพลย์บุ๊กไม่สำเร็จ ลองใหม่อีกครั้ง" }, 502);
    }

    await admin.from("integration_settings").upsert({ key: "learned_sales_playbook", value: playbook }, { onConflict: "key" });

    // Also keep the raw (already-anonymized) transcripts as RAG-searchable
    // knowledge, one chunk per example, so the AI can pull a closely
    // matching real exchange for an unusual situation the playbook summary
    // didn't capture.
    const { data: document, error: docError } = await admin
      .from("knowledge_documents")
      .insert({
        title: "AI เรียนรู้สไตล์การขาย — ตัวอย่างบทสนทนาจริง",
        source_type: "sales_script",
        raw_text: combined,
        created_by: userId,
      })
      .select("id")
      .single();
    if (docError) throw docError;

    const embeddings = await Promise.all(transcripts.map((t) => embed(t)));
    const { error: chunkError } = await admin
      .from("knowledge_chunks")
      .insert(transcripts.map((content, i) => ({ document_id: document.id, content, embedding: embeddings[i] })));
    if (chunkError) throw chunkError;

    return jsonResponse({ playbook, exampleCount: examples.length });
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "analyze-sales-style", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "analyze-sales-style", error);
  }
});
