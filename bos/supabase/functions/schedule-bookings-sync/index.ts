// schedule-bookings-sync — makes the real recurring timetable visible to
// the parts of the system that only know about bookings: Google Calendar
// (calendar-sync creates events from bookings), the lesson list, payroll,
// and revenue-per-lesson. The owner has entered 12 real weekly schedules in
// attendance_reminder_schedules but bookings stayed at zero, so the
// calendar/payroll side has been blind to the actual teaching load.
//
// Each active schedule's upcoming occurrences (next 14 days, starting from
// next_occurrence_at) become confirmed bookings. Idempotent: an occurrence
// is skipped when a booking for that customer already exists at that time.
// teacher_id stays null (schedules carry no teacher), which also means the
// booking exclusion constraint never blocks two students at the same time —
// true for this studio where one owner teaches everyone.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const DAYS_AHEAD = 14;
const LESSON_MINUTES = 60;
const MAX_PER_RUN = 100;

function toBkkDate(iso: string): Date {
  // Interpret the schedule's UTC timestamp in Bangkok wall-clock time so the
  // booking lands at the correct local lesson hour.
  const d = new Date(iso);
  const bkk = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return bkk;
}

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);

    const { data: schedules, error: schedErr } = await admin
      .from("attendance_reminder_schedules")
      .select("id, customer_id, day_of_week, time_of_day, next_occurrence_at")
      .eq("active", true)
      .limit(MAX_PER_RUN);
    if (schedErr) throw schedErr;

    const { data: customers } = await admin.from("customers").select("id, name");
    const nameById = new Map<string, string>((customers ?? []).map((c) => [c.id, c.name]));

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const schedule of (schedules ?? []) as { id: string; customer_id: string; day_of_week: number; time_of_day: string; next_occurrence_at: string }[]) {
      const customerName = nameById.get(schedule.customer_id) ?? "นักเรียน";
      let occurrence = new Date(schedule.next_occurrence_at);

      while (occurrence < horizon) {
        if (occurrence >= now) {
          const startBkk = toBkkDate(occurrence.toISOString());
          const startUtc = new Date(startBkk.getTime() - 7 * 60 * 60 * 1000).toISOString(); // BKK = UTC+7
          const endUtc = new Date(new Date(startUtc).getTime() + LESSON_MINUTES * 60 * 1000).toISOString();

          // Idempotency: skip when a booking already exists for this
          // customer at this time (previous run, or a manual booking).
          const { count, error: countErr } = await admin
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", schedule.customer_id)
            .gte("start_time", new Date(new Date(startUtc).getTime() - 30 * 60 * 1000).toISOString())
            .lte("start_time", new Date(new Date(startUtc).getTime() + 30 * 60 * 1000).toISOString());
          if (countErr) throw countErr;

          if ((count ?? 0) === 0) {
            const { error: insErr } = await admin.from("bookings").insert({
              customer_id: schedule.customer_id,
              course_id: null,
              teacher_id: null,
              google_event_id: null,
              title: `${customerName} คาบประจำสัปดาห์`,
              lesson_type: "normal",
              is_trial: false,
              status: "confirmed",
              start_time: startUtc,
              end_time: endUtc,
            });
            if (insErr) {
              failed += 1;
              await logSystemEvent(admin, "schedule-bookings-sync", "error", `schedule ${schedule.id} @ ${startUtc}: ${insErr.message}`);
            } else {
              created += 1;
            }
          } else {
            skipped += 1;
          }
        }
        occurrence = new Date(occurrence.getTime() + 7 * 24 * 60 * 60 * 1000); // next week
      }
    }

    if (created > 0) {
      await logSystemEvent(admin, "schedule-bookings-sync", "info", `created ${created} bookings from schedules (skipped ${skipped}, failed ${failed})`);
    }
    return jsonResponse({ scanned: (schedules ?? []).length, created, skipped, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "schedule-bookings-sync", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});
