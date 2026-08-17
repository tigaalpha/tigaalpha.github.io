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

    const { conversationId, message, lead } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) return jsonResponse({ error: "message is required" }, 400);

    // Lead capture: the widget can send a name/phone (typed into the little
    // form before chatting). Resolve to a customer (by LINE id, then phone,
    // then name) or create one, and bind the conversation — previously web
    // visitors stayed customer_id=null forever, so the AI could never sell
    // to them (same money-leak shape as LINE). The widget may pass just a
    // name with no phone yet; the AI enriches it during the chat.
    const leadName = lead && typeof lead.name === "string" ? lead.name.trim() : "";
    const leadPhone = lead && typeof lead.phone === "string" ? lead.phone.trim() : "";
    const leadLineUserId = lead && typeof lead.lineUserId === "string" ? lead.lineUserId.trim() : "";
    let customerId: string | null = null;
    if (leadName || leadPhone) {
      let customer: { id: string } | null = null;
      if (leadLineUserId) {
        const { data } = await admin.from("customers").select("id").eq("line_user_id", leadLineUserId).maybeSingle();
        customer = data;
      }
      if (!customer && leadPhone) {
        const { data } = await admin.from("customers").select("id").eq("phone", leadPhone).maybeSingle();
        customer = data;
      }
      if (!customer && leadName) {
        const { data } = await admin.from("customers").select("id").ilike("name", leadName).limit(1).maybeSingle();
        customer = data;
      }
      if (!customer && leadName) {
        const { data, error } = await admin
          .from("customers")
          .insert({
            name: leadName,
            phone: leadPhone || null,
            line_user_id: leadLineUserId || null,
            lead_source: "เว็บไซต์",
          })
          .select("id")
          .single();
        if (!error) {
          customer = data;
          await admin.from("sales_status_history").insert({ customer_id: data.id, to_status: "new_lead", note: "สร้างจากเว็บแชท (lead form)" });
        }
      }
      customerId = customer?.id ?? null;
    }

    let convId = conversationId;
    if (!convId) {
      const { data, error } = await admin.from("conversations").insert({ channel: "web", customer_id: customerId }).select("id").single();
      if (error) throw error;
      convId = data.id;
    } else if (customerId) {
      await admin.from("conversations").update({ customer_id: customerId }).eq("id", convId);
    }

    const result = await respond(admin, convId, message.trim());
    return jsonResponse({ conversationId: convId, customerId, ...result });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) return jsonResponse({ error: error.message }, 401);
    await logSystemEvent(admin, "web-chat", "error", error instanceof Error ? `${error.message} || ${error.stack ?? ""}` : String(error));
    return await handleUnexpectedError(admin, "web-chat", error);
  }
});
