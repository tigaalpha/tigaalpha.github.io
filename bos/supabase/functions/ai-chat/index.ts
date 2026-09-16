import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { respond } from "../_shared/chat-core.ts";
import { departmentBySlug } from "../_shared/departments.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { ModelUnavailableError } from "../_shared/openai-compatible.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "ai-chat", { windowMinutes: 5, maxRequests: 30 });

    const { conversationId, message, mode } = await req.json();
    if (!message) return jsonResponse({ error: "message is required" }, 400);

    // "owner" mode is TIGA AI AGENT — the studio owner/staff commanding the
    // AI directly (not a customer conversation), so it gets its own channel
    // (never shows in the customer Inbox), an owner-oriented system prompt
    // instead of the sales/customer-service one, and owner-only tools
    // (see OWNER_TOOLS in _shared/tools.ts).
    const isOwner = mode === "owner";

    let convId = conversationId;
    if (!convId) {
      const { data, error } = await admin
        .from("conversations")
        .insert({ channel: isOwner ? "internal" : "web" })
        .select("id")
        .single();
      if (error) throw error;
      convId = data.id;
    }

    // AI Automation department chats tag their conversations with
    // "dept:<slug>" in line_user_id (see features/ai-automation-chat). Those
    // chats speak with the department's own persona — and the Chief of Staff
    // chat gains the delegate_to_department tool so it can command every
    // other department across chats.
    let department = undefined;
    if (convId) {
      const { data: convRow } = await admin
        .from("conversations")
        .select("line_user_id")
        .eq("id", convId)
        .maybeSingle();
      const tag = convRow?.line_user_id;
      if (typeof tag === "string" && tag.startsWith("dept:")) {
        department = departmentBySlug(tag.slice("dept:".length)) ?? undefined;
      }
    }

    const result = isOwner
      ? await respond(admin, convId, message, ["owner", "sales", "booking", "knowledge"], userId, { department })
      : await respond(admin, convId, message);
    return jsonResponse({ conversationId: convId, ...result });
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "ai-chat", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    if (error instanceof ModelUnavailableError) {
      await logSystemEvent(admin, "ai-chat", "warning", error.message);
      return jsonResponse({ error: error.message }, 502);
    }
    return await handleUnexpectedError(admin, "ai-chat", error);
  }
});
