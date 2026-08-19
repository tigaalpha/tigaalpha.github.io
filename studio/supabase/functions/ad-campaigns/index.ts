import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { requestApproval } from "../_shared/approvals.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    if (req.method === "GET") {
      const { data, error } = await admin.from("ad_campaigns").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return jsonResponse({ campaigns: data ?? [] });
    }

    if (req.method === "POST") {
      const { id, action } = (await req.json()) as { id: string; action: "submit" | "reject" };
      if (!id || (action !== "submit" && action !== "reject")) {
        return jsonResponse({ error: "id and action ('submit' | 'reject') are required" }, 400);
      }

      const { data: campaign, error: fetchErr } = await admin.from("ad_campaigns").select("*").eq("id", id).single();
      if (fetchErr || !campaign) return jsonResponse({ error: "Campaign not found" }, 404);
      if (campaign.status !== "draft") return jsonResponse({ error: "Only draft campaigns can be submitted or rejected" }, 409);

      if (action === "reject") {
        const { data: updated, error } = await admin.from("ad_campaigns").update({ status: "rejected" }).eq("id", id).select("*").single();
        if (error) throw error;
        return jsonResponse({ campaign: updated });
      }

      // "submit" — mark pending and file the approval request. The campaign
      // only flips to 'approved' once staff approves it via the Approvals
      // page (approvals/index.ts executeApproved handles "ad_campaign_spend").
      const { data: updated, error: updateErr } = await admin.from("ad_campaigns").update({ status: "pending_approval" }).eq("id", id).select("*").single();
      if (updateErr) throw updateErr;

      await requestApproval(
        admin,
        "ad_campaign_spend",
        { campaignId: id },
        `แคมเปญ ${campaign.platform}: ${campaign.objective} (งบที่แนะนำ: ${campaign.budget_suggestion ?? "-"})`
      );

      return jsonResponse({ campaign: updated });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    return await handleUnexpectedError(admin, "ad-campaigns", error);
  }
});
