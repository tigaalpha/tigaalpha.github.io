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

    await Promise.all(
      drifted.map((booking: { id: string; title: string; customer_id: string; google_event_id: string | null }) =>
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

    return jsonResponse({ checked: bookings?.length ?? 0, drifted: drifted.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "calendar-sync", error);
  }
});
