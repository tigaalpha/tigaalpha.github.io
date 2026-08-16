import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { createLessonSummary } from "../_shared/lesson-summary.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

/**
 * Feature #5 — AI lesson summary endpoint (called from the web UI, or by the
 * AI itself in owner mode via the record_lesson_summary tool). Staff-authed
 * (verify_jwt=true, same as ai-chat).
 */
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireStaff(admin, req);
    const { bookingId, notes } = await req.json();
    if (!bookingId || typeof notes !== "string") return jsonResponse({ error: "bookingId and notes are required" }, 400);

    const result = await createLessonSummary(admin, { bookingId, rawNotes: notes, createdBy: userId });
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return await handleUnexpectedError(admin, "lesson-summary", error);
  }
});
