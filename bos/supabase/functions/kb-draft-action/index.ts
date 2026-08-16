import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff, requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { embed } from "../_shared/ai-provider.ts";
import { chunkText } from "../_shared/text.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Owner decides on a KB self-learning draft (kb-self-learn): approve →
// the question+answer becomes a real knowledge_documents row with embedded
// chunks (identical pipeline to knowledge-upload, so RAG finds it); reject →
// the draft is discarded. Only owner/admin can run this.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await requireOwnerOrAdmin(admin, userId);
    const { draftId, action } = (await req.json()) as { draftId?: string; action?: string };
    if (!draftId || (action !== "approve" && action !== "reject")) {
      return jsonResponse({ error: "draftId and action (approve|reject) are required" }, 400);
    }

    const { data: draft, error: draftErr } = await admin.from("kb_drafts").select("*").eq("id", draftId).maybeSingle();
    if (draftErr || !draft) return jsonResponse({ error: "ไม่พบ draft ที่ระบุ" }, 404);
    if (draft.status !== "pending") return jsonResponse({ error: "draft นี้ถูกจัดการไปแล้ว" }, 400);

    if (action === "reject") {
      await admin.from("kb_drafts").update({ status: "rejected" }).eq("id", draftId);
      return jsonResponse({ ok: true, status: "rejected" });
    }

    // Approve → insert document + embedded chunks (same as knowledge-upload).
    const content = `${draft.question}\n\n${draft.draft_answer}`;
    const { data: document, error: docErr } = await admin
      .from("knowledge_documents")
      .insert({ title: draft.question, source_type: "faq", raw_text: content, created_by: userId })
      .select("id")
      .single();
    if (docErr) throw docErr;

    for (const chunk of chunkText(content)) {
      const [embedding] = await Promise.all([embed(chunk)]);
      await admin.from("knowledge_chunks").insert({ document_id: document.id, content: chunk, embedding });
    }

    await admin.from("kb_drafts").update({ status: "approved" }).eq("id", draftId);
    await logSystemEvent(admin, "kb-draft-action", "info", `approved draft ${draftId} → document ${document.id}`);
    return jsonResponse({ ok: true, status: "approved", documentId: document.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 400);
  }
});
