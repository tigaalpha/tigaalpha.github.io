import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";
import { isDripDue, renderDripTemplate, customerInSegment, type CampaignSegment } from "../_shared/drip.ts";

const MAX_PER_RUN = 50;

/**
 * Feature #7 — drip marketing. Every 6 hours (pg_cron), for each active
 * campaign, every LINE-connected customer in its segment who hasn't received
 * this campaign's message within interval_days gets it. drip_sends rows are
 * the per-customer dedupe (unique campaign+customer).
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  let sent = 0;

  const { data: campaigns, error: campErr } = await admin.from("drip_campaigns").select("id, name, segment, message_template, interval_days").eq("active", true);
  if (campErr) throw campErr;

  for (const campaign of campaigns ?? []) {
    if (sent >= MAX_PER_RUN) break;

    const { data: customers, error: custErr } = await admin
      .from("customers")
      .select("id, name, line_user_id, sales_status, referral_code")
      .not("line_user_id", "is", null)
      .limit(MAX_PER_RUN * 2);
    if (custErr) throw custErr;

    for (const customer of customers ?? []) {
      if (sent >= MAX_PER_RUN) break;
      if (!customerInSegment(customer.sales_status, campaign.segment as CampaignSegment | null)) continue;

      const { data: lastSend } = await admin
        .from("drip_sends")
        .select("sent_at")
        .eq("campaign_id", campaign.id)
        .eq("customer_id", customer.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isDripDue(lastSend?.sent_at ?? null, campaign.interval_days, now)) continue;

      const text = renderDripTemplate(campaign.message_template, { name: customer.name, code: customer.referral_code ?? "" });
      try {
        await push(customer.line_user_id, text);
      } catch {
        continue; // blocked OA
      }
      await admin.from("drip_sends").insert({ campaign_id: campaign.id, customer_id: customer.id });
      sent += 1;
    }
  }

  return jsonResponse({ campaigns: campaigns?.length ?? 0, sent });
});
