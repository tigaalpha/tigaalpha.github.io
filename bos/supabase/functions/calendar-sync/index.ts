import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import * as calendar from "../_shared/calendar.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
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
    const drifted = (bookings ?? []).filter((b: { google_event_id: string | null }) => b.google_event_id && !eventIds.has(b.google_event_id));

    await Promise.all(
      drifted.map((booking: { id: string; title: string; customer_id: string }) =>
        admin.from("notifications").insert({
          type: "conflict_booking",
          title: "Calendar event missing or moved",
          body: `Booking "${booking.title}" no longer matches its Google Calendar event.`,
          customer_id: booking.customer_id,
          booking_id: booking.id,
        })
      )
    );

    return jsonResponse({ checked: bookings?.length ?? 0, drifted: drifted.length });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
