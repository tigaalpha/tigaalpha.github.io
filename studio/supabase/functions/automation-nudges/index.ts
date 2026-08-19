import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { push } from "../_shared/line.ts";

const MAX_PER_RUN = 20;
const INACTIVE_DAYS = 60; // reactivation: no lesson for 2 months
const REACTIVATION_COOLDOWN_DAYS = 30; // don't nag more than once a month
const RENEWAL_REMAINING_HOURS = 3;
const REVIEW_MIN_COMPLETED_LESSONS = 3;
const REVIEW_COOLDOWN_DAYS = 60;
const WAITLIST_FREED_SLOT_WINDOW_MS = 24 * 60 * 60 * 1000; // only offer recently-freed slots

const RENEWAL_ALREADY_HANDLED_STATUSES = ["renew_pending", "renewed", "lost"];
const REACTIVATION_MESSAGE =
  "สวัสดีค่ะ คิดถึงนะคะ 🎹 ไม่ได้เจอกันนานเลย ยังอยากเรียนเปียโนต่อไหมคะ? ช่วงนี้มีคอร์สใหม่และโปรโมชันสำหรับนักเรียนเก่า ทักมาได้เลยนะคะ จะแนะนำให้ค่ะ 😊";
const RENEWAL_MESSAGE =
  "สวัสดีค่ะ น้องใกล้เรียนครบคอร์สแล้วนะคะ 🎉 อยากให้เรียนต่อไหมคะ? ทักมาได้เลย ทางเราจะแนะนำคอร์สใหม่และโปรโมชันสำหรับนักเรียนต่อคอร์สให้ค่ะ 😊";
const WAITLIST_OFFER_PREFIX = "สวัสดีค่ะ มีคาบว่างกะทันหันสำหรับครูที่คุณสนใจ อยากให้จองช่วงเวลานี้ไหมคะ?";

/**
 * Feature #3 (waitlist), #6 (reactivation), #8 (renewal), #11 (reviews).
 * Hourly cron; every pass is guarded by its own "last sent" marker so an
 * hourly tick can never spam a customer twice for the same thing.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  const { data: secretRow } = await admin.from("integration_settings").select("value").eq("key", "cron_secret").maybeSingle();
  if (!secretRow?.value || req.headers.get("x-cron-secret") !== secretRow.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  let reactivated = 0;
  let renewalOffered = 0;
  let reviewAsked = 0;
  let waitlistOffered = 0;

  // ---- #6 reactivation: students who stopped coming 60+ days ago ----
  const { data: candidates, error: candErr } = await admin
    .from("customers")
    .select("id, name, line_user_id, sales_status, last_reactivation_at")
    .not("line_user_id", "is", null)
    .not("sales_status", "in", "('won','lost','renewed')")
    .limit(MAX_PER_RUN * 5);
  if (candErr) throw candErr;

  for (const customer of candidates ?? []) {
    if (reactivated >= MAX_PER_RUN) break;
    if (customer.last_reactivation_at && now - new Date(customer.last_reactivation_at).getTime() < REACTIVATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) continue;

    const { data: lastBooking } = await admin
      .from("bookings")
      .select("start_time")
      .eq("customer_id", customer.id)
      .neq("status", "cancelled")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastBooking && now - new Date(lastBooking.start_time).getTime() < INACTIVE_DAYS * 24 * 60 * 60 * 1000) continue;

    try {
      await push(customer.line_user_id, REACTIVATION_MESSAGE, ["สนใจค่ะ", "ยังไม่สะดวก"]);
    } catch {
      continue; // blocked OA
    }
    const nowIso = new Date(now).toISOString();
    await admin.from("customers").update({ last_reactivation_at: nowIso }).eq("id", customer.id);
    await admin.from("reactivation_log").insert({ customer_id: customer.id, message: REACTIVATION_MESSAGE });
    await admin.from("notifications").insert({ type: "reactivation", title: "ส่งข้อความทักลูกค้าเก่าแล้ว", body: customer.name, customer_id: customer.id });
    reactivated += 1;
  }

  // ---- #8 renewal: active courses with few hours left ----
  const { data: nearEndCourses, error: courseErr } = await admin
    .from("courses")
    .select("id, remaining_hour, total_hours, customer_id, customers(id, name, line_user_id, sales_status, renewal_offer_sent_at)")
    .gt("remaining_hour", 0)
    .lte("remaining_hour", RENEWAL_REMAINING_HOURS)
    .limit(MAX_PER_RUN * 3);
  if (courseErr) throw courseErr;

  for (const course of nearEndCourses ?? []) {
    if (renewalOffered >= MAX_PER_RUN) break;
    const customer = (course as { customers?: { id?: string; name?: string; line_user_id?: string; sales_status?: string; renewal_offer_sent_at?: string } | null }).customers;
    if (!customer?.line_user_id || !customer.id) continue;
    if (customer.sales_status && RENEWAL_ALREADY_HANDLED_STATUSES.includes(customer.sales_status)) continue;
    if (customer.renewal_offer_sent_at) continue;

    try {
      await push(customer.line_user_id, RENEWAL_MESSAGE, ["สนใจต่อคอร์สค่ะ", "ยังไม่แน่ใจ"]);
    } catch {
      continue;
    }
    await admin.from("customers").update({ renewal_offer_sent_at: new Date(now).toISOString() }).eq("id", customer.id);
    await admin.from("notifications").insert({ type: "renewal_offer", title: "เสนอต่อคอร์สอัตโนมัติ", body: `${customer.name} — เหลือ ${course.remaining_hour}/${course.total_hours} ชม.`, customer_id: customer.id });
    renewalOffered += 1;
  }

  // ---- #11 reviews: ask for a Google review after 3+ completed lessons ----
  const { data: reviewUrlRow } = await admin.from("integration_settings").select("value").eq("key", "google_review_url").maybeSingle();
  if (reviewUrlRow?.value) {
    const { data: reviewedCustomers, error: revErr } = await admin
      .from("customers")
      .select("id, name, line_user_id, review_asked_at")
      .not("line_user_id", "is", null)
      .is("review_asked_at", null)
      .limit(MAX_PER_RUN * 5);
    if (revErr) throw revErr;

    for (const customer of reviewedCustomers ?? []) {
      if (reviewAsked >= MAX_PER_RUN) break;
      const { count } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .eq("status", "completed");
      if ((count ?? 0) < REVIEW_MIN_COMPLETED_LESSONS) continue;

      try {
        await push(customer.line_user_id, `สวัสดีค่ะ ขอบคุณที่ไว้ใจเรียนกับ Tiga Studio มาโดยตลอด 🎹 ถ้าพอใจกับการเรียน ช่วยแชร์ประสบการณ์ให้คนอื่นรู้จักเราหน่อยได้ไหมคะ 🙏\n${reviewUrlRow.value}`);
      } catch {
        continue;
      }
      await admin.from("customers").update({ review_asked_at: new Date(now).toISOString() }).eq("id", customer.id);
      await admin.from("notifications").insert({ type: "review_request", title: "ขอรีวิวจากลูกค้าแล้ว", body: customer.name, customer_id: customer.id });
      reviewAsked += 1;
    }
  }

  // ---- #3 waitlist: recently-freed future slots offered to waiting customers ----
  const { data: freedSlots, error: freedErr } = await admin
    .from("bookings")
    .select("id, teacher_id, title, start_time, waitlist_offered_at, updated_at")
    .eq("status", "cancelled")
    .gt("start_time", new Date(now).toISOString())
    .limit(MAX_PER_RUN * 3);
  if (freedErr) throw freedErr;

  for (const slot of freedSlots ?? []) {
    if (waitlistOffered >= MAX_PER_RUN) break;
    if (slot.waitlist_offered_at) continue;
    if (now - new Date(slot.updated_at).getTime() > WAITLIST_FREED_SLOT_WINDOW_MS) continue;
    if (!slot.teacher_id) continue;

    const { data: waiters, error: waitErr } = await admin
      .from("waitlist")
      .select("id, customer_id, customers(name, line_user_id)")
      .eq("teacher_id", slot.teacher_id)
      .eq("active", true)
      .limit(5);
    if (waitErr) throw waitErr;

    for (const waiter of waiters ?? []) {
      if (waitlistOffered >= MAX_PER_RUN) break;
      const customer = (waiter as { customers?: { name?: string; line_user_id?: string } | null }).customers;
      if (!customer?.line_user_id) continue;
      const lessonTime = formatBkkTime(slot.start_time);
      try {
        await push(customer.line_user_id, `${WAITLIST_OFFER_PREFIX}\n\n${slot.title} · ${lessonTime} น.`, ["✅ จองเลย", "ไม่สะดวก"]);
        waitlistOffered += 1;
      } catch {
        // blocked OA
      }
    }
    await admin.from("bookings").update({ waitlist_offered_at: new Date(now).toISOString() }).eq("id", slot.id);
  }

  return jsonResponse({ reactivated, renewalOffered, reviewAsked, waitlistOffered });
});

function formatBkkTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}
