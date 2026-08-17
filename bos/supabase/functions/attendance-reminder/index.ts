import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push } from "../_shared/line.ts";
import { computeNextRun } from "../_shared/schedule.ts";

const REMINDER_WINDOW_START_MS = 23.5 * 60 * 60 * 1000; // ~23.5h ahead
const REMINDER_WINDOW_END_MS = 24.5 * 60 * 60 * 1000; // ~24.5h ahead -- 1h window comfortably covers the 30min cron tick
const MAX_PER_RUN = 30;

// Tapping one of these sends its text back as an ordinary customer message,
// which the AI then records via record_attendance_confirmation.
const CONFIRM_QUICK_REPLIES = ["✅ มาเรียน", "❌ มาไม่ได้"];

/**
 * Called every 30 minutes by pg_cron + pg_net (see migration 0074). Two
 * passes per run:
 * 1. Reminder: any active weekly attendance slot whose next_occurrence_at
 *    falls ~24h from now gets a LINE confirmation message, once per
 *    occurrence (last_reminded_occurrence guards against re-sending on
 *    the next tick).
 * 2. Rollover: any slot whose next_occurrence_at has already passed
 *    advances to next week's occurrence (see computeNextRun's "weekly"
 *    branch) -- kept separate from the reminder pass so next_occurrence_at
 *    always reflects the real upcoming lesson, not a stale past one.
 */
Deno.serve(async (req: Request) => {
  const admin = createAdminClient();

  // Accept env OR DB cron secret (see cron-auth.ts) — some crons bake the
  // env value at creation, older ones read integration_settings live.
  if (!(await checkCronSecret(admin, req))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const now = Date.now();
  let reminded = 0;
  let rolledOver = 0;

  // Pass 1: send reminders due ~24h ahead.
  const { data: dueSoon, error: dueSoonError } = await admin
    .from("attendance_reminder_schedules")
    .select("id, customer_id, day_of_week, time_of_day, next_occurrence_at, last_reminded_occurrence")
    .eq("active", true)
    .gte("next_occurrence_at", new Date(now + REMINDER_WINDOW_START_MS).toISOString())
    .lte("next_occurrence_at", new Date(now + REMINDER_WINDOW_END_MS).toISOString())
    .limit(MAX_PER_RUN);
  if (dueSoonError) throw dueSoonError;

  for (const schedule of dueSoon ?? []) {
    if (schedule.last_reminded_occurrence === schedule.next_occurrence_at) continue; // already reminded for this exact occurrence

    // Recurring occurrences materialized into bookings (schedule-bookings-
    // sync) are reminded by the booking pass below — skip here so the
    // customer never gets two "มาเรียนไหมคะ" messages for one lesson.
    const occ = new Date(schedule.next_occurrence_at);
    const { count: bookingCount } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", schedule.customer_id)
      .gte("start_time", new Date(occ.getTime() - 30 * 60 * 1000).toISOString())
      .lte("start_time", new Date(occ.getTime() + 30 * 60 * 1000).toISOString());
    if ((bookingCount ?? 0) > 0) continue; // the booking pass handles this one

    const { data: customer } = await admin.from("customers").select("id, name, line_user_id").eq("id", schedule.customer_id).maybeSingle();
    if (!customer?.line_user_id) continue; // no LINE connection to remind through

    const lessonTime = schedule.time_of_day.slice(0, 5);
    const text = `สวัสดีค่ะ พรุ่งนี้น้อง${customer.name}มีเรียนเวลา ${lessonTime} น. รบกวนยืนยันว่าจะมาเรียนได้เลยไหมคะ 😊`;

    try {
      await push(customer.line_user_id, text, CONFIRM_QUICK_REPLIES);
    } catch {
      continue; // customer may have blocked the OA -- skip, don't fail the whole batch
    }

    let { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("line_user_id", customer.line_user_id)
      .eq("channel", "line")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversation) {
      const { data: created } = await admin
        .from("conversations")
        .insert({ channel: "line", line_user_id: customer.line_user_id, customer_id: customer.id })
        .select("id")
        .single();
      conversation = created;
    }
    if (conversation) {
      await admin.from("messages").insert({ conversation_id: conversation.id, sender: "ai", content: text, metadata: { attendanceReminder: true } });
    }

    await admin.from("attendance_reminder_schedules").update({ last_reminded_occurrence: schedule.next_occurrence_at }).eq("id", schedule.id);
    reminded += 1;
  }

  // Pass 1b: one-off lessons (every booking the AI or staff made) ~24h
  // ahead get the same confirmation ask. attendance_reminded_at guards
  // against re-asking the same booking on the next 30-min tick.
  const { data: dueBookings, error: dueBookingsError } = await admin
    .from("bookings")
    .select("id, customer_id, title, start_time, google_event_id, attendance_status, attendance_reminded_at")
    .in("status", ["confirmed", "rescheduled"])
    .eq("attendance_status", "unconfirmed")
    .gte("start_time", new Date(now + REMINDER_WINDOW_START_MS).toISOString())
    .lte("start_time", new Date(now + REMINDER_WINDOW_END_MS).toISOString())
    .limit(MAX_PER_RUN);
  if (dueBookingsError) throw dueBookingsError;

  for (const booking of dueBookings ?? []) {
    if (booking.attendance_reminded_at) continue; // already asked for this lesson

    const { data: customer } = await admin.from("customers").select("id, name, line_user_id").eq("id", booking.customer_id).maybeSingle();
    if (!customer?.line_user_id) continue; // no LINE connection to remind through

    const lessonTime = formatBkkTime(booking.start_time);
    const text = `สวัสดีค่ะ พรุ่งนี้น้อง${customer.name}มีเรียน \"${booking.title}\" เวลา ${lessonTime} น. รบกวนยืนยันว่าจะมาเรียนได้เลยไหมคะ 😊`;

    try {
      await push(customer.line_user_id, text, CONFIRM_QUICK_REPLIES);
    } catch {
      continue; // customer may have blocked the OA -- skip, don't fail the whole batch
    }

    let { data: conversation } = await admin
      .from("conversations")
      .select("id")
      .eq("line_user_id", customer.line_user_id)
      .eq("channel", "line")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversation) {
      const { data: created } = await admin
        .from("conversations")
        .insert({ channel: "line", line_user_id: customer.line_user_id, customer_id: customer.id })
        .select("id")
        .single();
      conversation = created;
    }
    if (conversation) {
      await admin.from("messages").insert({ conversation_id: conversation.id, sender: "ai", content: text, metadata: { attendanceReminder: true, bookingId: booking.id } });
    }

    await admin.from("bookings").update({ attendance_reminded_at: new Date(now).toISOString() }).eq("id", booking.id);
    reminded += 1;
  }

  // Pass 2: roll forward any occurrence that has already passed.
  const { data: past, error: pastError } = await admin
    .from("attendance_reminder_schedules")
    .select("id, day_of_week, time_of_day, next_occurrence_at")
    .eq("active", true)
    .lt("next_occurrence_at", new Date(now).toISOString())
    .limit(MAX_PER_RUN);
  if (pastError) throw pastError;

  for (const schedule of past ?? []) {
    const nextOccurrence = computeNextRun(
      { recurrenceType: "weekly", intervalDays: null, dayOfWeek: schedule.day_of_week, dayOfMonth: null, timeOfDay: schedule.time_of_day, runOnceAt: null },
      new Date(schedule.next_occurrence_at)
    );
    if (!nextOccurrence) continue;
    await admin.from("attendance_reminder_schedules").update({ next_occurrence_at: nextOccurrence.toISOString() }).eq("id", schedule.id);
    rolledOver += 1;
  }

  return jsonResponse({ reminded, rolledOver });
});

function formatBkkTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}
