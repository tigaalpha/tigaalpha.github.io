import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import * as calendar from "../_shared/calendar.ts";

// Postgres error code for a violated EXCLUDE/UNIQUE constraint — see
// migration 0023_booking_race_conditions. The app-level pre-check below is
// kept only for a fast, friendly rejection on the common (non-concurrent)
// case; this constraint is the actual atomic guard against double-booking.
const EXCLUSION_VIOLATION = "23P01";
function isExclusionViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === EXCLUSION_VIOLATION);
}

interface CreateBody {
  action: "create";
  customerId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
}
interface RescheduleBody {
  action: "reschedule";
  bookingId: string;
  newStart: string;
  newEnd: string;
}
interface CancelOrCompleteBody {
  action: "cancel" | "complete";
  bookingId: string;
}
type RequestBody = CreateBody | RescheduleBody | CancelOrCompleteBody;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const body = (await req.json()) as RequestBody;

    const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;
    const isDateString = (v: unknown): v is string => isId(v) && !Number.isNaN(new Date(v).getTime());

    if (body.action === "create") {
      if (!isId(body.customerId) || !isId(body.teacherId) || !isDateString(body.startTime) || !isDateString(body.endTime)) {
        return jsonResponse({ error: "customerId, teacherId, startTime, and endTime are required" }, 400);
      }
    } else if (body.action === "reschedule") {
      if (!isId(body.bookingId) || !isDateString(body.newStart) || !isDateString(body.newEnd)) {
        return jsonResponse({ error: "bookingId, newStart, and newEnd are required" }, 400);
      }
    } else if (body.action === "cancel" || body.action === "complete") {
      if (!isId(body.bookingId)) {
        return jsonResponse({ error: "bookingId is required" }, 400);
      }
    } else {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    if (body.action === "create") {
      const { data: customer, error: custErr } = await admin.from("customers").select("*").eq("id", body.customerId).single();
      if (custErr || !customer) return jsonResponse({ error: "Customer not found" }, 404);

      const { data: course, error: courseErr } = await admin
        .from("courses")
        .select("*")
        .eq("customer_id", body.customerId)
        .gt("remaining_hour", 0)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (courseErr || !course) return jsonResponse({ error: "No active course with remaining hours" }, 409);

      // Lesson number/title/type must come from how many lessons are already
      // booked for this course, not course.current_hour (which only advances
      // when a lesson is completed) — otherwise booking two future lessons
      // ahead of completion mints the same lesson number/title for both.
      const { count: bookedCount, error: countErr } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id)
        .neq("status", "cancelled");
      if (countErr) throw countErr;

      const lessonNumber = (bookedCount ?? 0) + 1;
      const lessonType = lessonNumber >= course.total_hours ? "final" : "normal";
      const title = `${lessonNumber}${String(customer.name).trim().replace(/\s+/g, "").toUpperCase()}`;

      // Insert before touching Google Calendar: the DB exclusion constraint
      // (migration 0023) is the atomic conflict guard, so the booking must
      // exist or be rejected before any external side effect happens.
      const { data: booking, error: bookingErr } = await admin
        .from("bookings")
        .insert({
          customer_id: body.customerId,
          course_id: course.id,
          teacher_id: body.teacherId,
          google_event_id: null,
          title,
          lesson_type: lessonType,
          status: "confirmed",
          start_time: body.startTime,
          end_time: body.endTime,
        })
        .select("*")
        .single();

      if (bookingErr) {
        if (isExclusionViolation(bookingErr)) {
          await admin.from("notifications").insert({
            type: "conflict_booking",
            title: "Booking conflict",
            body: `Attempted lesson for ${customer.name} at ${body.startTime} clashes with an existing booking for this teacher.`,
            customer_id: body.customerId,
          });
          return jsonResponse({ error: "Teacher already booked in this time range" }, 409);
        }
        throw bookingErr;
      }

      const event = await calendar.createEvent({ title, startTime: body.startTime, endTime: body.endTime, lessonType });
      const { data: withEvent } = await admin.from("bookings").update({ google_event_id: event.id }).eq("id", booking.id).select("*").single();

      return jsonResponse({ booking: withEvent ?? booking, lessonNumber, lessonType }, 201);
    }

    if (body.action === "reschedule") {
      const { data: booking } = await admin.from("bookings").select("*").eq("id", body.bookingId).single();
      if (!booking) return jsonResponse({ error: "Booking not found" }, 404);

      // DB update first — goes through the exclusion constraint atomically,
      // before Google Calendar is touched (previously the calendar event was
      // moved first, so a rejected reschedule left the calendar showing a
      // time the DB never actually accepted).
      const { data: updated, error } = await admin
        .from("bookings")
        .update({ start_time: body.newStart, end_time: body.newEnd, status: "rescheduled" })
        .eq("id", body.bookingId)
        .select("*")
        .single();

      if (error) {
        if (isExclusionViolation(error)) return jsonResponse({ error: "Teacher already booked in this time range" }, 409);
        throw error;
      }

      if (updated.google_event_id) {
        await calendar.updateEvent(updated.google_event_id, { startTime: body.newStart, endTime: body.newEnd });
      }
      return jsonResponse(updated);
    }

    if (body.action === "cancel") {
      const { data: booking } = await admin.from("bookings").select("*").eq("id", body.bookingId).single();
      if (!booking) return jsonResponse({ error: "Booking not found" }, 404);

      // DB status flip first: if the calendar delete below fails, the
      // booking is still correctly cancelled (bookable again in our system)
      // rather than left "confirmed" while its calendar event is gone.
      const { data: updated, error } = await admin
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", body.bookingId)
        .select("*")
        .single();
      if (error) throw error;

      if (booking.google_event_id) await calendar.deleteEvent(booking.google_event_id);
      return jsonResponse(updated);
    }

    if (body.action === "complete") {
      const { data: updated, error } = await admin
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", body.bookingId)
        .select("*")
        .single();
      if (error) throw error;

      if (updated.lesson_type === "final") {
        await admin.from("notifications").insert({
          type: "payment_reminder",
          title: "Collect payment for completed course",
          body: `Final lesson "${updated.title}" is done — collect payment and offer renewal.`,
          customer_id: updated.customer_id,
          booking_id: updated.id,
        });
      }

      return jsonResponse(updated);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    return await handleUnexpectedError(admin, "bookings", error);
  }
});
