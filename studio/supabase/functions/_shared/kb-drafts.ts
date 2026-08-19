// Shared KB-draft approval pipeline — used by three callers so they can
// never drift: the Knowledge page (kb-draft-action), the owner's LINE
// commands (อนุมัติ KB), and the daily auto-approve cron (ops-auto-approve).
// Approving inserts a real knowledge_documents row + embedded chunks
// (identical to knowledge-upload, so RAG finds it) and marks the draft
// approved.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { embed } from "./ai-provider.ts";
import { chunkText } from "./text.ts";

export async function approveKbDraft(
  admin: SupabaseClient,
  draftId: string,
  createdBy?: string | null
): Promise<{ documentId: string }> {
  const { data: draft, error } = await admin.from("kb_drafts").select("*").eq("id", draftId).maybeSingle();
  if (error || !draft) throw new Error("ไม่พบ draft ที่ระบุ");
  if (draft.status !== "pending") throw new Error("draft นี้ถูกจัดการไปแล้ว");

  // knowledge_documents.created_by references profiles(id); when the caller
  // has no session (LINE commands, cron), resolve the owner profile so the
  // insert never violates the FK.
  let createdById = createdBy ?? undefined;
  if (!createdById) {
    const { data: ownerProfile } = await admin.from("profiles").select("id").eq("role", "owner").limit(1).maybeSingle();
    createdById = ownerProfile?.id ?? undefined;
  }

  const content = `${draft.question}\n\n${draft.draft_answer}`;
  const { data: document, error: docErr } = await admin
    .from("knowledge_documents")
    .insert({ title: draft.question, source_type: "faq", raw_text: content, created_by: createdById })
    .select("id")
    .single();
  if (docErr) throw docErr;

  for (const chunk of chunkText(content)) {
    const [embedding] = await Promise.all([embed(chunk)]);
    await admin.from("knowledge_chunks").insert({ document_id: document.id, content: chunk, embedding });
  }

  await admin.from("kb_drafts").update({ status: "approved" }).eq("id", draftId);
  return { documentId: document.id };
}
