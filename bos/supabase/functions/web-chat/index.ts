import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { respond } from "../_shared/chat-core.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

/**
 * Feature #4 — public web chat widget endpoint (embedded on the studio's
 * marketing site). Not a Supabase-JWT endpoint (verify_jwt=false) — the
 * widget can't log in; instead it sends a shared secret header
 * (x-web-chat-secret, configured in integration_settings key
 * `web_chat_secret`) that the site owner embeds in the widget script, so a
 * random internet user can't burn the studio's AI budget by hammering the
 * endpoint directly. Conversations are channel "web" with no customer link
 * until the visitor identifies themselves — the AI has zero customer tools
 * there (chat-core only offers OWNER_TOOLS on channel "internal").
 */
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "web_chat_secret").maybeSingle();
    if (!secretRow?.value || req.headers.get("x-web-chat-secret") !== secretRow.value) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { conversationId, message } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) return jsonResponse({ error: "message is required" }, 400);

    let convId = conversationId;
    if (!convId) {
      const { data, error } = await admin.from("conversations").insert({ channel: "web" }).select("id").single();
      if (error) throw error;
      convId = data.id;
    }

    const result = await respond(admin, convId, message.trim());
    return jsonResponse({ conversationId: convId, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) return jsonResponse({ error: error.message }, 401);
    await logSystemEvent(admin, "web-chat", "error", error instanceof Error ? error.message : String(error));
    return await handleUnexpectedError(admin, "web-chat", error);
  }
});
