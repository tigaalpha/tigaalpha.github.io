import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";

const MAX_PER_RUN = 20;
const FEEDBACK_AFTER_MS = 30 * 60 * 1000; // ~30min after the trial lesson ends
const FEEDBACK_WINDOW_MS = 2.5 * 60 * 60 * 1000; // keep checking for ~2.5h, then mark sent anyway
const OFFER_AFTER_MS = 24 * 60 * 60 * 1000; // ~24h after the trial

const FEEDBACK_MESSAGE =
  "สวัสดีค่ะ คุณพ่อคุณแม่/น้องๆ ที่มาเรียนทดลองวันนี้ 🎹 อยากถามว่าวันนี้เป็นยังไงบ้างคะ ถูกใจครูผู้สอนและการเรียนไหมคะ?";
const OFFER_MESSAGE =
  "สวัสดีค่ะ หลังจากที่ได้ลองเรียนทดลองมาแล้ว ยังสนใจเริ่มเรียนจริงไหมคะ? มีคอร์สเรียนให้เลือกตามเป้าหมาย เช่น 20/40/80 ชั่วโมง พร้อมครูผู้สอนที่เข้ากับน้องที่สุดได้เลยค่ะ ถ้าสนใจ ทักมาได้เลยนะคะ จะแนะนำคอร์สที่เหมาะที่สุดให้ค่ะ 😊";

/**
 * Feature #2 — post-trial automation. Called every 30 minutes by pg_cron.
 * Two stages per trial booking:
 *   1. ~30min after the trial lesson ends: ask for feedback.
 *   2. ~24h later: offer the real course (the AI closes the sale from there
 *      when the customer replies — it has the full sales tools).
 * Guarded by post_trial_feedback_sent_at / post_trial_offer_sent_at so the
 * 30-min tick can never re-send the same stage.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  let feedbackSent = 0;
  let offerSent = 0;

  const { data: trials, error } = await admin
    .from("bookings")
    .select("id, customer_id, title, start_time, post_trial_feedback_sent_at, post_trial_offer_sent_at")
    .eq("is_trial", true)
    .in("status", ["confirmed", "rescheduled", "completed"])
    .lt("start_time", new Date(now).toISOString())
    .limit(MAX_PER_RUN * 3);
  if (error) throw error;

  for (const booking of trials ?? []) {
    const lessonEndedAt = new Date(booking.start_time).getTime();

    if (!booking.post_trial_feedback_sent_at && lessonEndedAt + FEEDBACK_AFTER_MS <= now) {
      // Mark sent even if push fails so we never retry a blocked customer forever.
      await admin.from("bookings").update({ post_trial_feedback_sent_at: new Date(now).toISOString() }).eq("id", booking.id);
      if (lessonEndedAt + FEEDBACK_AFTER_MS + FEEDBACK_WINDOW_MS < now) continue; // window passed, don't spam stale trials

      const { data: customer } = await admin.from("customers").select("line_user_id").eq("id", booking.customer_id).maybeSingle();
      if (!customer?.line_user_id) continue;
      try {
        await push(customer.line_user_id, FEEDBACK_MESSAGE, ["👍 ดีมากเลยค่ะ", "ยังไม่แน่ใจ", "อยากคุยกับเจ้าของ"]);
        feedbackSent += 1;
      } catch {
        // blocked OA — already marked sent above
      }
      continue;
    }

    if (booking.post_trial_feedback_sent_at && !booking.post_trial_offer_sent_at && lessonEndedAt + OFFER_AFTER_MS <= now) {
      await admin.from("bookings").update({ post_trial_offer_sent_at: new Date(now).toISOString() }).eq("id", booking.id);
      const { data: customer } = await admin.from("customers").select("line_user_id").eq("id", booking.customer_id).maybeSingle();
      if (!customer?.line_user_id) continue;
      try {
        await push(customer.line_user_id, OFFER_MESSAGE, ["สนใจค่ะ", "ขอดูรายละเอียดคอร์ส"]);
        offerSent += 1;
      } catch {
        // blocked OA
      }
    }
  }

  return jsonResponse({ checked: trials?.length ?? 0, feedbackSent, offerSent });
});
