import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";

const TRIAL_OFFER_AFTER_MS = 60 * 60 * 1000; // ~1h of silence after the opening exchange
const MAX_OPENING_MESSAGES = 2; // customer's first message + our opening reply -- only this early stage gets this nudge
const MAX_PER_RUN = 30;

const TRIAL_OFFER_MESSAGE =
  "สวัสดีค่ะ ยังสนใจอยู่ไหมคะ? ถ้ายังไม่แน่ใจ ทางเรามีให้ทดลองเรียนฟรี 1 ครั้งด้วยนะคะ ได้ลองบรรยากาศและวิธีการสอนก่อนตัดสินใจได้เลยค่ะ สนใจทดลองเรียนไหมคะ 😊";

/**
 * Called every 15 minutes by pg_cron + pg_net (see migration 0072). A
 * brand-new customer who saw the opening pitch and went quiet for about an
 * hour gets ONE separate nudge offering the free trial lesson -- kept out
 * of the opening message itself per the owner's request, and out of the
 * longer 48h/4d/7d re-engagement sequence in follow-up-conversations
 * (different targeting: this is opening-stage only, any sales_status).
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: candidates, error } = await admin
    .from("conversations")
    .select("id, line_user_id")
    .eq("channel", "line")
    .not("line_user_id", "is", null)
    .eq("trial_offer_sent", false)
    .limit(MAX_PER_RUN * 3); // over-fetch, then filter by real opening-stage activity below
  if (error) throw error;

  let sent = 0;

  for (const conversation of candidates ?? []) {
    if (sent >= MAX_PER_RUN) break;

    const { data: allMessages } = await admin
      .from("messages")
      .select("sender, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(MAX_OPENING_MESSAGES + 1); // +1 lets us cheaply detect "more than the opening exchange happened"
    if (!allMessages || allMessages.length === 0 || allMessages.length > MAX_OPENING_MESSAGES) continue;

    const lastMessage = allMessages[allMessages.length - 1];
    if (lastMessage.sender !== "ai") continue; // customer already replied -- not quiet
    if (new Date(lastMessage.created_at).getTime() > Date.now() - TRIAL_OFFER_AFTER_MS) continue; // not quiet long enough yet

    try {
      await push(conversation.line_user_id as string, TRIAL_OFFER_MESSAGE);
    } catch {
      continue; // customer may have blocked the OA -- skip, don't fail the whole batch
    }

    await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender: "ai",
      content: TRIAL_OFFER_MESSAGE,
      metadata: { trialOffer: true },
    });
    await admin.from("conversations").update({ trial_offer_sent: true }).eq("id", conversation.id);

    sent += 1;
  }

  return jsonResponse({ checked: candidates?.length ?? 0, sent });
});
