import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { embed } from "../_shared/ai-provider.ts";
import { chunkText } from "../_shared/text.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";

// Unbounded content meant unbounded chunkText() output and an unbounded
// number of paid embed() calls fired in parallel from one request — a
// single oversized "document" could spike memory and run up embedding
// costs in one shot. ~200k chars is generous for any real knowledge doc.
const MAX_CONTENT_LENGTH = 200_000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "knowledge-upload", { windowMinutes: 60, maxRequests: 20 });

    const { title, sourceType, content } = await req.json();
    if (!title || !sourceType || !content) {
      return jsonResponse({ error: "title, sourceType and content are required" }, 400);
    }
    if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
      return jsonResponse({ error: `content must be ${MAX_CONTENT_LENGTH} characters or fewer` }, 400);
    }

    const { data: document, error: docErr } = await admin
      .from("knowledge_documents")
      .insert({ title, source_type: sourceType, raw_text: content, created_by: userId })
      .select("*")
      .single();
    if (docErr) throw docErr;

    const chunks = chunkText(content);
    // Even under MAX_CONTENT_LENGTH this can be ~250 chunks — firing all of
    // them as one Promise.all was ~250 concurrent Gemini calls from a single
    // request, its own mini quota-exhaustion event. Process in small batches.
    const EMBED_BATCH_SIZE = 10;
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      embeddings.push(...(await Promise.all(batch.map((chunk) => embed(chunk)))));
    }

    const { error: chunkErr } = await admin.from("knowledge_chunks").insert(
      chunks.map((chunkContent, i) => ({ document_id: document.id, content: chunkContent, embedding: embeddings[i] }))
    );
    if (chunkErr) throw chunkErr;

    return jsonResponse({ document }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
