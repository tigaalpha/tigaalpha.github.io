import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { push as linePush } from "../_shared/line.ts";
import { learnFromStaffReply } from "../_shared/auto-kb.ts";

/**
 * Delivers a staff-typed reply from the Inbox (features/chat/components/
 * message-thread.tsx "Reply as owner...") to the actual customer. Before
 * this, the Inbox's send button only inserted a `messages` row -- it never
 * reached the customer on LINE, since LINE customers aren't a live web
 * session and need a real push() call. Web-widget conversations already
 * get the reply via the existing Realtime subscription on the insert
 * below, so no extra delivery path is needed for those.
 */
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const { conversationId, content } = await req.json();
    if (!conversationId || typeof content !== "string" || !content.trim()) {
      return jsonResponse({ error: "conversationId and content are required" }, 400);
    }
    const text = content.trim();

    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("channel, line_user_id")
      .eq("id", conversationId)
      .single();
    if (convError) throw convError;

    if (conversation.channel === "line" && conversation.line_user_id) {
      await linePush(conversation.line_user_id, text);
    }

    const { error: insertError } = await admin.from("messages").insert({ conversation_id: conversationId, sender: "owner", content: text });
    if (insertError) throw insertError;

    // Staff just handled it directly -- no longer needs a review flag.
    await admin.from("conversations").update({ needs_review: false, updated_at: new Date().toISOString() }).eq("id", conversationId);

    // Feature #12: when this was an escalated conversation (the AI couldn't
    // answer), the staff answer becomes a new Knowledge Base entry so the
    // AI handles the same question alone next time. Never blocks the reply.
    await learnFromStaffReply(admin, conversationId, text).catch(() => {});

    return jsonResponse({ ok: true });
  } catch (error) {
    return await handleUnexpectedError(admin, "send-staff-reply", error);
  }
});
