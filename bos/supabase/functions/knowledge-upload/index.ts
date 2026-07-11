import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { embed } from "../_shared/ai-provider.ts";
import { chunkText } from "../_shared/text.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    const userId = await requireStaff(admin, req);

    const { title, sourceType, content } = await req.json();
    if (!title || !sourceType || !content) {
      return jsonResponse({ error: "title, sourceType and content are required" }, 400);
    }

    const { data: document, error: docErr } = await admin
      .from("knowledge_documents")
      .insert({ title, source_type: sourceType, raw_text: content, created_by: userId })
      .select("*")
      .single();
    if (docErr) throw docErr;

    const chunks = chunkText(content);
    const embeddings = await Promise.all(chunks.map((chunk) => embed(chunk)));

    const { error: chunkErr } = await admin.from("knowledge_chunks").insert(
      chunks.map((chunkContent, i) => ({ document_id: document.id, content: chunkContent, embedding: embeddings[i] }))
    );
    if (chunkErr) throw chunkErr;

    return jsonResponse({ document }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
