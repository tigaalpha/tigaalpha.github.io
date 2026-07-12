import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";
import { generate } from "../_shared/ai-provider.ts";
import { buildSystemPrompt } from "../_shared/prompts.ts";

const STALE_AFTER_MS = 48 * 60 * 60 * 1000; // 48h of silence counts as "abandoned"
const MAX_PER_RUN = 20; // bound cost/blast-radius per cron tick
const MID_FUNNEL_STATUSES = [
  "contacted", "qualified", "interested", "trial_booked",
  "trial_completed", "negotiating", "waiting_decision", "renew_pending",
];

/**
 * Called on a schedule by pg_cron + pg_net (see migration 0015). Public
 * (verify_jwt=false) because pg_net has no Supabase session to attach —
 * authenticated instead by a random secret stored in integration_settings,
 * checked via the x-cron-secret header.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: candidates, error } = await admin
    .from("conversations")
    .select("id, line_user_id, summary, customer_id, last_followed_up_at, customers!inner(id, name, sales_status)")
    .eq("channel", "line")
    .not("line_user_id", "is", null)
    .in("customers.sales_status", MID_FUNNEL_STATUSES)
    .or(`last_followed_up_at.is.null,last_followed_up_at.lt.${staleBefore}`)
    .limit(MAX_PER_RUN * 3); // over-fetch, then filter by real last-activity below
  if (error) throw error;

  let sent = 0;

  for (const conversation of candidates ?? []) {
    if (sent >= MAX_PER_RUN) break;

    const { data: lastMessage } = await admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastMessage || new Date(lastMessage.created_at).getTime() > Date.now() - STALE_AFTER_MS) continue;

    const customer = Array.isArray(conversation.customers) ? conversation.customers[0] : conversation.customers;

    const followUpPrompt = [
      buildSystemPrompt(["sales", "renewal"]),
      "The customer below has gone quiet mid-conversation. Write ONE short, warm, natural follow-up message " +
        "(like a real staff member checking in, not a pushy sales bot) to re-open the conversation. " +
        "Reference what you last discussed if the summary mentions it. No greeting like 'Dear customer'. " +
        "Reply with ONLY the message text, nothing else.",
      `Customer name: ${customer?.name ?? "the customer"}`,
      `Sales stage: ${customer?.sales_status ?? "unknown"}`,
      conversation.summary ? `Conversation summary: ${conversation.summary}` : "No summary available — keep it general.",
    ].join("\n\n");

    const result = await generate([{ role: "user", content: followUpPrompt }], undefined, 0.7, 200);
    const text = result.message.content.trim();
    if (!text) continue;

    try {
      await push(conversation.line_user_id as string, text);
    } catch {
      continue; // customer may have blocked the OA — skip, don't fail the whole batch
    }

    await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender: "ai",
      content: text,
      metadata: { followUp: true },
    });
    await admin.from("conversations").update({ last_followed_up_at: new Date().toISOString() }).eq("id", conversation.id);

    sent += 1;
  }

  return jsonResponse({ checked: candidates?.length ?? 0, followedUp: sent });
});
