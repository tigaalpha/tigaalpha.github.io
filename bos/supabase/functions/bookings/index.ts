import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import * as calendar from "../_shared/calendar.ts";

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

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const body = (await req.json()) as RequestBody;

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

      const { data: conflicts } = await admin
        .from("bookings")
        .select("id")
        .eq("teacher_id", body.teacherId)
        .neq("status", "cancelled")
        .lt("start_time", body.endTime)
        .gt("end_time", body.startTime);
      if (conflicts && conflicts.length > 0) {
        await admin.from("notifications").insert({
          type: "conflict_booking",
          title: "Booking conflict",
          body: `Attempted lesson for ${customer.name} at ${body.startTime} clashes with an existing booking for this teacher.`,
          customer_id: body.customerId,
        });
        return jsonResponse({ error: "Teacher already booked in this time range" }, 409);
      }

      const lessonNumber = course.current_hour + 1;
      const lessonType = lessonNumber >= course.total_hours ? "final" : "normal";
      const title = `${lessonNumber}${String(customer.name).trim().replace(/\s+/g, "").toUpperCase()}`;

      const event = await calendar.createEvent({ title, startTime: body.startTime, endTime: body.endTime, lessonType });

      const { data: booking, error: bookingErr } = await admin
        .from("bookings")
        .insert({
          customer_id: body.customerId,
          course_id: course.id,
          teacher_id: body.teacherId,
          google_event_id: event.id,
          title,
          lesson_type: lessonType,
          status: "confirmed",
          start_time: body.startTime,
          end_time: body.endTime,
        })
        .select("*")
        .single();
      if (bookingErr) throw bookingErr;

      return jsonResponse({ booking, lessonNumber, lessonType }, 201);
    }

    if (body.action === "reschedule") {
      const { data: booking } = await admin.from("bookings").select("*").eq("id", body.bookingId).single();
      if (!booking) return jsonResponse({ error: "Booking not found" }, 404);

      if (booking.google_event_id) {
        await calendar.updateEvent(booking.google_event_id, { startTime: body.newStart, endTime: body.newEnd });
      }

      const { data: updated, error } = await admin
        .from("bookings")
        .update({ start_time: body.newStart, end_time: body.newEnd, status: "rescheduled" })
        .eq("id", body.bookingId)
        .select("*")
        .single();
      if (error) throw error;
      return jsonResponse(updated);
    }

    if (body.action === "cancel") {
      const { data: booking } = await admin.from("bookings").select("*").eq("id", body.bookingId).single();
      if (!booking) return jsonResponse({ error: "Booking not found" }, 404);
      if (booking.google_event_id) await calendar.deleteEvent(booking.google_event_id);

      const { data: updated, error } = await admin
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", body.bookingId)
        .select("*")
        .single();
      if (error) throw error;
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
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
