import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { verifySignature, reply } from "../_shared/line.ts";
import { respond } from "../_shared/chat-core.ts";

interface LineEvent {
  type: string;
  source: { userId?: string };
  message?: { type: string; text?: string };
  replyToken?: string;
  webhookEventId?: string;
}

// LINE retries a webhook delivery on timeout/non-200, so the same event
// can arrive twice. Insert-first dedup on LINE's own per-event id: if the
// insert conflicts, this event was already handled -- skip it rather than
// generating a second AI reply (and a second tool-call side effect, e.g.
// a second booking, if the reply involved one). If an event genuinely has
// no id (shouldn't happen per LINE's schema), process it anyway rather
// than silently dropping a customer message.
async function alreadyProcessed(admin: ReturnType<typeof createAdminClient>, webhookEventId: string | undefined): Promise<boolean> {
  if (!webhookEventId) return false;
  const { error } = await admin.from("line_webhook_events").insert({ event_id: webhookEventId });
  // Postgres unique_violation
  return error?.code === "23505";
}

async function processEvents(admin: ReturnType<typeof createAdminClient>, events: LineEvent[]): Promise<void> {
  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || event.message?.type !== "text" || !event.source.userId || !event.replyToken) {
        return;
      }
      if (await alreadyProcessed(admin, event.webhookEventId)) return;

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
}

// Public webhook — authenticated by the LINE signature, not a Supabase JWT.
// Deploy with verify_jwt=false.
Deno.serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!await verifySignature(rawBody, signature)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const admin = createAdminClient();
  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  EdgeRuntime.waitUntil(processEvents(admin, body.events));

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
