import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createContainer } from "@/services/container";

/**
 * Reconciles bookings against Google Calendar: any booking whose event was
 * deleted/moved directly in Google Calendar gets flagged as a conflict
 * notification instead of silently drifting out of sync.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? new Date().toISOString();
  const end = searchParams.get("end") ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { calendar, repos } = createContainer(supabase);

  const [events, bookings] = await Promise.all([
    calendar.listEventsBetween(start, end),
    repos.bookings.listBetween(start, end),
  ]);

  const eventIds = new Set(events.map((event) => event.id));
  const drifted = bookings.filter((booking) => booking.google_event_id && !eventIds.has(booking.google_event_id));

  await Promise.all(
    drifted.map((booking) =>
      repos.notifications.create(
        "conflict_booking",
        "Calendar event missing or moved",
        `Booking "${booking.title}" no longer matches its Google Calendar event.`,
        booking.customer_id,
        booking.id
      )
    )
  );

  return NextResponse.json({ checked: bookings.length, drifted: drifted.length });
}
