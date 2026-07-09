import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { verifySignature, reply } from "../_shared/line.ts";
import { respond } from "../_shared/chat-core.ts";

interface LineEvent {
  type: string;
  source: { userId?: string };
  message?: { type: string; text?: string };
  replyToken?: string;
}

// Public webhook — authenticated by the LINE signature, not a Supabase JWT.
// Deploy with verify_jwt=false.
Deno.serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const admin = createAdminClient();
  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  await Promise.all(
    body.events.map(async (event) => {
      if (event.type !== "message" || event.message?.type !== "text" || !event.source.userId || !event.replyToken) {
        return;
      }

      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;

      const { data: customer } = await admin.from("customers").select("id").eq("line_user_id", lineUserId).maybeSingle();

      let conversationId: string;
      const { data: existing } = await admin
        .from("conversations")
        .select("id")
        .eq("line_user_id", lineUserId)
        .eq("channel", "line")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: created, error } = await admin
          .from("conversations")
          .insert({ channel: "line", line_user_id: lineUserId, customer_id: customer?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = created.id;
      }

      const { reply: text } = await respond(admin, conversationId, event.message?.text ?? "");
      await reply(replyToken, text);
    })
  );

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
