import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { generateStudentProgress } from "../_shared/ai-reports.ts";

// On-demand (the "สร้างสรุปพัฒนาการ" button on the student detail page) --
// not cron-triggered like the daily/weekly briefings.
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 30 };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-student-progress", RATE_LIMIT);

    const { customerId } = await req.json();
    if (!customerId || typeof customerId !== "string") return jsonResponse({ error: "customerId is required" }, 400);

    const report = await generateStudentProgress(admin, customerId);
    return jsonResponse({ report });
  } catch (error) {
    if (error instanceof RateLimitError) return jsonResponse({ error: error.message }, 429);
    return await handleUnexpectedError(admin, "generate-student-progress", error);
  }
});
