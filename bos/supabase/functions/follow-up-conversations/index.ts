import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";
import { generate } from "../_shared/ai-provider.ts";
import { buildSystemPrompt } from "../_shared/prompts.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";

const STALE_AFTER_MS = 48 * 60 * 60 * 1000; // 48h of silence counts as "abandoned"
const MAX_PER_RUN = 20; // bound cost/blast-radius per cron tick
const MID_FUNNEL_STATUSES = [
  "contacted", "qualified", "interested", "trial_booked",
  "trial_completed", "negotiating", "waiting_decision", "renew_pending",
];

// Staged re-engagement: a single generic nudge recovers fewer leads than a
// short escalating sequence (standard B2B/e-commerce nurture practice) --
// index = conversations.follow_up_count. Interval is measured from the
// customer's last real activity for the first nudge, and from the previous
// nudge itself for later ones (so a customer who ignores nudge 1 gets
// nudge 2 a few days later, not immediately). Stops after 3 -- an
// unanswered 3rd touch means genuinely not interested right now, and
// keeping the door open beats being ignored, not being pushy about it.
const FOLLOW_UP_STAGES = [
  { afterMs: 48 * 60 * 60 * 1000, tone: "This is the first check-in -- keep it light and casual, just re-opening the door, no pressure." },
  { afterMs: 4 * 24 * 60 * 60 * 1000, tone: "This is the second check-in after the first went unanswered -- be a bit more concrete: ask if there's a specific question or concern holding them back, or remind them the free trial lesson offer is still open." },
  { afterMs: 7 * 24 * 60 * 60 * 1000, tone: "This is the final check-in in this sequence -- keep it low-pressure and respectful: let them know it's completely fine if now isn't the right time, and that you're happy to help whenever they're ready. Do not push." },
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

  const { data: candidates, error } = await admin
    .from("conversations")
    .select("id, line_user_id, summary, customer_id, last_followed_up_at, follow_up_count, customers!inner(id, name, sales_status)")
    .eq("channel", "line")
    .not("line_user_id", "is", null)
    .in("customers.sales_status", MID_FUNNEL_STATUSES)
    .lt("follow_up_count", FOLLOW_UP_STAGES.length)
    .limit(MAX_PER_RUN * 3); // over-fetch, then filter by real last-activity below
  if (error) throw error;

  let sent = 0;

  for (const conversation of candidates ?? []) {
    if (sent >= MAX_PER_RUN) break;

    const stage = conversation.follow_up_count ?? 0;
    if (stage >= FOLLOW_UP_STAGES.length) continue;

    const { data: lastMessage } = await admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Never nudge a conversation that's currently active, regardless of
    // stage -- if the customer replied (even after a prior nudge), this is
    // the newest message and resets this gate.
    if (!lastMessage || new Date(lastMessage.created_at).getTime() > Date.now() - STALE_AFTER_MS) continue;

    // The stage-specific interval is measured from the previous nudge
    // (so stage 2 lands a few days after stage 1 was ignored, not
    // immediately) -- or from that same last-activity check for the very
    // first nudge, when there's no previous nudge yet.
    const referenceTime = conversation.last_followed_up_at
      ? new Date(conversation.last_followed_up_at).getTime()
      : new Date(lastMessage.created_at).getTime();
    if (Date.now() - referenceTime < FOLLOW_UP_STAGES[stage].afterMs) continue;

    const customer = Array.isArray(conversation.customers) ? conversation.customers[0] : conversation.customers;

    const followUpPrompt = [
      buildSystemPrompt(["sales", "renewal"]),
      "The customer below has gone quiet mid-conversation. Write ONE short, warm, natural follow-up message " +
        "(like a real staff member checking in, not a pushy sales bot) to re-open the conversation. " +
        "Reference what you last discussed if the summary mentions it. No greeting like 'Dear customer'. " +
        "Reply with ONLY the message text, nothing else.",
      FOLLOW_UP_STAGES[stage].tone,
      `Customer name: ${customer?.name ?? "the customer"}`,
      `Sales stage: ${customer?.sales_status ?? "unknown"}`,
      conversation.summary ? `Conversation summary: ${conversation.summary}` : "No summary available — keep it general.",
    ].join("\n\n");

    const result = await generate([{ role: "user", content: followUpPrompt }], undefined, 0.7, 200, "content");
    await logAiUsage(admin, result.usage, "follow-up-conversations");
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
      metadata: { followUp: true, stage },
    });
    await admin
      .from("conversations")
      .update({ last_followed_up_at: new Date().toISOString(), follow_up_count: stage + 1 })
      .eq("id", conversation.id);

    sent += 1;
  }

  return jsonResponse({ checked: candidates?.length ?? 0, followedUp: sent });
});
