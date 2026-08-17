import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import * as line from "../_shared/line.ts";

// A weekly nudge, not another thing to remember -- TikTok/X have no free
// API at all, and Instagram's saves/shares/views need a permission beyond
// what's connected (see marketing-metrics-snapshot/index.ts), so those
// numbers only ever update when the owner types them in. This just pings
// once a week instead of leaving it to memory. Cron-only (see migration),
// no on-demand path needed.

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;  const admin = createAdminClient();

  if (!(await checkCronSecret(admin, req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { data: ownerLineIdRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (!ownerLineIdRow?.value) return jsonResponse({ sent: false, reason: "owner_line_user_id not set" });

    await line.push(
      ownerLineIdRow.value,
      "รายสัปดาห์: อย่าลืมกรอกยอด TikTok, X และยอด views/แชร์/บันทึกของ Instagram ใน Marketing Dashboard นะครับ — ใช้เวลาไม่กี่นาที ช่องทางอื่นระบบซิงค์ให้อัตโนมัติแล้ว"
    );

    return jsonResponse({ sent: true });
  } catch (error) {
    return await handleUnexpectedError(admin, "marketing-manual-entry-reminder", error);
  }
});
