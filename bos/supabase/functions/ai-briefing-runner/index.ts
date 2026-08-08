import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { generateDailyBriefing, generateWeeklyBusinessReport } from "../_shared/ai-reports.ts";
import * as line from "../_shared/line.ts";

// Cron-triggered (0058_ai_workforce_cron_jobs.sql — daily at 07:00 Bangkok,
// weekly Mondays) — reportType in the body picks which of the two to
// generate. Notifies the owner both in-app and over LINE (if
// owner_line_user_id is set in Settings > Integrations, same key the
// emergency-alert notification already uses).
Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  try {
    const { reportType } = await req.json();
    if (reportType !== "daily_briefing" && reportType !== "weekly_business_report") {
      return jsonResponse({ error: "reportType must be 'daily_briefing' or 'weekly_business_report'" }, 400);
    }

    const report = reportType === "daily_briefing" ? await generateDailyBriefing(admin) : await generateWeeklyBusinessReport(admin);

    await admin.from("notifications").insert({
      type: "automation",
      title: reportType === "daily_briefing" ? "สรุปธุรกิจประจำวัน" : "สรุปธุรกิจประจำสัปดาห์",
      body: report.content.slice(0, 300),
    });

    const { data: ownerLineIdRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerLineIdRow?.value) {
      await line.push(ownerLineIdRow.value, report.content.slice(0, 2000));
    }

    return jsonResponse({ reportId: report.id });
  } catch (error) {
    return await handleUnexpectedError(admin, "ai-briefing-runner", error);
  }
});
