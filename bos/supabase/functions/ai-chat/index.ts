import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { respond } from "../_shared/chat-core.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const { conversationId, message } = await req.json();
    if (!message) return jsonResponse({ error: "message is required" }, 400);

    let convId = conversationId;
    if (!convId) {
      const { data, error } = await admin.from("conversations").insert({ channel: "web" }).select("id").single();
      if (error) throw error;
      convId = data.id;
    }

    const result = await respond(admin, convId, message);
    return jsonResponse({ conversationId: convId, ...result });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
