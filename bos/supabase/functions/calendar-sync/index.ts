import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import * as calendar from "../_shared/calendar.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const { start, end } = await req.json().catch(() => ({}));
    const rangeStart = start ?? new Date().toISOString();
    const rangeEnd = end ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const [events, { data: bookings, error }] = await Promise.all([
      calendar.listEventsBetween(rangeStart, rangeEnd),
      admin.from("bookings").select("*").gte("start_time", rangeStart).lte("start_time", rangeEnd).neq("status", "cancelled"),
    ]);
    if (error) throw error;

    const eventIds = new Set(events.map((e) => e.id));
    // Two distinct drift cases: (a) a booking's linked event vanished from
    // the calendar, or (b) booking creation succeeded in the DB but the
    // Google Calendar event was never created (google_event_id still null —
    // possible since bookings/index.ts and tools.ts now insert the booking
    // row before creating the calendar event, so a calendar-side failure
    // leaves a valid, unsynced booking rather than losing it).
    const drifted = (bookings ?? []).filter(
      (b: { google_event_id: string | null }) => (b.google_event_id && !eventIds.has(b.google_event_id)) || !b.google_event_id
    );

    // Auto-heal: for a booking whose calendar event is missing, try to
    // (re)create the event rather than only flagging it — the booking row
    // has everything createEvent needs. Only bookings whose event *id is
    // recorded but the event itself vanished (case a) are recreated; case
    // (b) with a never-synced booking is recreated too, so a transient
    // calendar failure on booking creation self-repairs on the next sync
    // tick instead of leaving a permanent drift notification.
    let healed = 0;
    let failed = 0;
    const healedBookings: { id: string; title: string; customer_id: string; google_event_id: string | null; lesson_type: string; start_time: string; end_time: string }[] = [];
    for (const booking of drifted as { id: string; title: string; customer_id: string; google_event_id: string | null; lesson_type: string; start_time: string; end_time: string }[]) {
      try {
        const event = await calendar.createEvent({
          title: booking.title,
          startTime: booking.start_time,
          endTime: booking.end_time,
          lessonType: booking.lesson_type === "final" ? "final" : "normal",
        });
        await admin.from("bookings").update({ google_event_id: event.id }).eq("id", booking.id);
        healed += 1;
        healedBookings.push(booking);
      } catch {
        // Calendar genuinely unreachable — keep the drift notification so
        // the owner knows it still needs a manual fix.
        failed += 1;
      }
    }

    // Only notify about bookings that could NOT be healed (calendar
    // unreachable) — a healed booking is back in sync, no owner action
    // needed.
    const stillDrifted = (drifted as { id: string }[]).filter((b) => !healedBookings.some((h) => h.id === b.id));
    await Promise.all(
      stillDrifted.map((booking: { id: string; title: string; customer_id: string; google_event_id: string | null }) =>
        admin.from("notifications").insert({
          type: "conflict_booking",
          title: booking.google_event_id ? "Calendar event missing or moved" : "Booking never synced to Google Calendar",
          body: booking.google_event_id
            ? `Booking "${booking.title}" no longer matches its Google Calendar event.`
            : `Booking "${booking.title}" was saved but Google Calendar sync failed — add it to the calendar manually or retry.`,
          customer_id: booking.customer_id,
          booking_id: booking.id,
        })
      )
    );

    return jsonResponse({ checked: bookings?.length ?? 0, drifted: drifted.length, healed, failed });
  } catch (error) {
    return await handleUnexpectedError(admin, "calendar-sync", error);
  }
});
