// Auto-KB learning (feature #12): when a staff member answers a customer's
// question from the Inbox (send-staff-reply), that Q&A pair becomes a new
// Knowledge Base document automatically — so the AI learns the owner's
// answer and next time handles it alone. Deliberately conservative:
//   * only fires when the conversation was flagged needs_review (i.e. the AI
//     already admitted it couldn't answer — never for routine chatter)
//   * a unique question hash prevents the same question being re-learned
//     endlessly
//   * the owner gets a notification + LINE ping on every auto-save so she
//     can delete the entry if the answer was one-off/private

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { embed } from "./ai-provider.ts";
import { chunkText } from "./text.ts";
import { push as linePush } from "./line.ts";

const MIN_ANSWER_LENGTH = 40;
const KNOWLEDGE_SOURCE_TYPE = "faq";

async function hashQuestion(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function learnFromStaffReply(admin: SupabaseClient, conversationId: string, staffAnswer: string): Promise<{ learned: boolean; reason?: string }> {
  const answer = staffAnswer.trim();
  if (answer.length < MIN_ANSWER_LENGTH) return { learned: false, reason: "answer too short" };

  const { data: conversation, error: convErr } = await admin
    .from("conversations")
    .select("customer_id, needs_review")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr) throw convErr;
  if (!conversation) return { learned: false, reason: "conversation not found" };
  if (!conversation.needs_review) return { learned: false, reason: "not escalated" };
  if (!conversation.customer_id) return { learned: false, reason: "no customer link" };

  const { data: lastCustomerMessage } = await admin
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("sender", "customer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const question = lastCustomerMessage?.content?.trim();
  if (!question || question.length < 5) return { learned: false, reason: "no question" };

  const questionHash = await hashQuestion(question);
  const { data: existing } = await admin.from("kb_learning_log").select("id").eq("question_hash", questionHash).maybeSingle();
  if (existing) return { learned: false, reason: "already learned" };

  const title = question.length > 80 ? `${question.slice(0, 77)}...` : question;
  const { data: doc, error: docErr } = await admin
    .from("knowledge_documents")
    .insert({ title, source_type: KNOWLEDGE_SOURCE_TYPE, raw_text: answer, auto_generated: true })
    .select("id")
    .single();
  if (docErr) throw docErr;

  const chunks = chunkText(answer);
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    embeddings.push(...(await Promise.all(batch.map((chunk) => embed(chunk)))));
  }
  const { error: chunkErr } = await admin
    .from("knowledge_chunks")
    .insert(chunks.map((chunkContent, i) => ({ document_id: doc.id, content: chunkContent, embedding: embeddings[i] })));
  if (chunkErr) throw chunkErr;

  await admin.from("kb_learning_log").insert({ question_hash: questionHash, customer_id: conversation.customer_id, question, answer, document_id: doc.id });

  await admin.from("notifications").insert({
    type: "kb_auto_learned",
    title: "AI เรียนรู้คำตอบใหม่จากคุณแล้ว",
    body: `คำถาม: ${question.slice(0, 120)} — บันทึกเป็นความรู้แล้ว (ตรวจสอบได้ใน Knowledge Base)`,
  });
  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    await linePush(ownerRow.value, `📚 AI เรียนรู้คำตอบใหม่จากคำตอบของคุณแล้ว: \"${question.slice(0, 80)}\" — ลบได้ในหน้า Knowledge Base ถ้าไม่ต้องการให้บันทึก`).catch(() => {});
  }

  return { learned: true };
}
